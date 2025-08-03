import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	NodeConnectionType,
	ApplicationError,
} from 'n8n-workflow';

import { promises as fs } from 'fs';
import * as path from 'path';

export class SaveFile implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Save File (Advanced)',
		name: 'saveFileAdvanced',
		icon: 'fa:save',
		group: ['output'],
		version: 1,
		subtitle: 'Saves files with advanced options',
		description:
			'Saves binary or text/JSON data to a file with advanced naming and overwrite options.',
		defaults: {
			name: 'Save File (Advanced)',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
		credentials: [],
		properties: [
			// Required Properties
			{
				displayName: 'Folder Path',
				name: 'folderPath',
				type: 'string',
				default: '/tmp/n8n-files',
				placeholder: '/data/files',
				description:
					'The folder where files will be saved. Can be an absolute path or use expressions.',
				required: true,
			},
			{
				displayName: 'Input Data Mode',
				name: 'inputMode',
				type: 'options',
				options: [
					{ name: 'Binary', value: 'binary' },
					{ name: 'Text/JSON', value: 'text' },
				],
				default: 'binary',
				description: 'The type of input data to save',
			},
			{
				displayName: 'Binary Property Name',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				displayOptions: {
					show: {
						inputMode: ['binary'],
					},
				},
				description: 'The name of the binary property on the input item to use',
			},
			{
				displayName: 'Source Field',
				name: 'dataField',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						inputMode: ['text'],
					},
				},
				description: 'The name of the field in the JSON data to save',
			},
			{
				displayName: 'Base Filename',
				name: 'baseFileName',
				type: 'string',
				default: 'file',
				description:
					'The base name for the output file. Used as the `{base}` token in the pattern. If empty, it will try to get it from the binary data `fileName` property.',
			},
			{
				displayName: 'File Extension',
				name: 'fileExtension',
				type: 'string',
				default: '',
				placeholder: 'txt',
				description:
					'The file extension to use. If empty, it will be derived from the binary data `fileName` or will be `JSON` for text mode.',
			},

			// Optional Properties
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Counter Padding (Zeros)',
						name: 'counterPadding',
						type: 'number',
						typeOptions: {
							minValue: 0,
						},
						default: 3,
						description:
							'The number of zeros to pad the counter with. For example, a padding of 4 will turn `1` into `0001`.',
					},
					{
						displayName: 'Counter Start',
						name: 'counterStart',
						type: 'number',
						typeOptions: {
							minValue: 0,
						},
						default: 1,
						description: 'The starting number for the counter',
					},
					{
						displayName: 'Create Folders',
						name: 'createFolders',
						type: 'boolean',
						default: true,
						description: 'Whether to create the destination folder if it does not exist',
					},
					{
						displayName: 'Custom Pattern',
						name: 'customPattern',
						type: 'string',
						default: '{base}_{counter}',
						description:
							'A custom pattern for the filename. Supports `{base}` and `{counter}` tokens.',
					},
					{
						displayName: 'Overwrite Existing File',
						name: 'overwrite',
						type: 'boolean',
						default: false,
						description: 'Whether any existing file with the same name will be overwritten',
					},
				],
			},
		],
	};

	private static sanitizeFilename(name: string): string {
		if (typeof name !== 'string') return '';
		return name.replace(/[\/\\?%*:|"<>]/g, '-').trim();
	}

	private static padCounter(n: number, pad: number): string {
		if (!pad || pad <= 0) return String(n);
		return String(n).padStart(pad, '0');
	}

	private static formatFilename(
		pattern: string,
		base: string,
		counter: number,
		pad: number,
		extension: string,
	): string {
		const counterStr = SaveFile.padCounter(counter, pad);
		const name = pattern.replace('{base}', base).replace('{counter}', counterStr);
		const sanitizedName = SaveFile.sanitizeFilename(name);
		return extension ? `${sanitizedName}.${extension}` : sanitizedName;
	}

	private static async scanExistingCounters(
		folder: string,
		pattern: string,
		base: string,
		extension: string,
	): Promise<Set<number>> {
		const existingCounters = new Set<number>();

		try {
			const files = await fs.readdir(folder);
			const sanitizedBase = SaveFile.sanitizeFilename(base);

			// Create regex to match our pattern and extract counter values
			const escapedBase = sanitizedBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const escapedExt = extension ? extension.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';

			// Build regex based on the pattern
			let regexPattern = pattern.replace('{base}', escapedBase).replace('{counter}', '(\\d+)');

			if (extension) {
				regexPattern += `\\.${escapedExt}`;
			}

			const fileRegex = new RegExp(`^${regexPattern}$`);

			// Extract counter values from existing files
			for (const file of files) {
				const match = file.match(fileRegex);
				if (match && match[1]) {
					const existingCounter = parseInt(match[1], 10);
					if (!isNaN(existingCounter)) {
						existingCounters.add(existingCounter);
					}
				}
			}
		} catch (err: any) {
			// If we can't read the directory (e.g., it doesn't exist), return empty set
			if (err.code !== 'ENOENT') {
				throw err;
			}
		}

		return existingCounters;
	}

	private static findNextAvailableCounter(
		existingCounters: Set<number>,
		startCounter: number,
		maxAttempts: number,
	): number {
		let counter = startCounter;

		// Find the first available counter starting from startCounter
		while (existingCounters.has(counter) && counter < startCounter + maxAttempts) {
			counter++;
		}

		if (counter >= startCounter + maxAttempts) {
			throw new ApplicationError(
				`Could not find free counter after ${maxAttempts} attempts starting from ${startCounter}.`,
			);
		}

		return counter;
	}

	private static async createFileAtomically(
		folder: string,
		pattern: string,
		base: string,
		counter: number,
		pad: number,
		extension: string,
		buffer: Buffer,
	): Promise<string> {
		const filename = SaveFile.formatFilename(pattern, base, counter, pad, extension);
		const fullPath = path.join(folder, filename);

		let filehandle;
		try {
			filehandle = await fs.open(fullPath, 'wx');
			await filehandle.writeFile(buffer);
			return fullPath;
		} finally {
			if (filehandle) {
				await filehandle.close();
			}
		}
	}

	private static async createFile(
		folder: string,
		pattern: string,
		base: string,
		startCounter: number,
		pad: number,
		extension: string,
		buffer: Buffer,
		maxRetries: number = 100,
	): Promise<string> {
		for (let attempts = 0; attempts < maxRetries; attempts++) {
			try {
				return await SaveFile.createFileAtomically(
					folder,
					pattern,
					base,
					startCounter + attempts,
					pad,
					extension,
					buffer,
				);
			} catch (err: any) {
				if (err.code !== 'EEXIST') {
					throw err;
				}
				// Continue trying with next counter
			}
		}

		throw new ApplicationError(
			`Could not find free filename for base "${base}" after scanning existing files and retrying ${maxRetries} times.`,
		);
	}

	private static async findAndWrite(
		folder: string,
		pattern: string,
		base: string,
		startCounter: number,
		pad: number,
		extension: string,
		buffer: Buffer,
		overwrite: boolean = false,
		maxAttempts: number = 10000,
	): Promise<string> {
		// If overwrite is enabled, just write the file directly
		if (overwrite) {
			const filename = SaveFile.formatFilename(pattern, base, startCounter, pad, extension);
			const fullPath = path.join(folder, filename);
			await fs.writeFile(fullPath, buffer);
			return fullPath;
		}

		// Scan existing files to find the next available counter
		const existingCounters = await SaveFile.scanExistingCounters(folder, pattern, base, extension);
		const optimalCounter = SaveFile.findNextAvailableCounter(
			existingCounters,
			startCounter,
			maxAttempts,
		);

		// Try to create the file with the optimal counter
		try {
			return await SaveFile.createFile(
				folder,
				pattern,
				base,
				optimalCounter,
				pad,
				extension,
				buffer,
			);
		} catch (err: any) {
			throw err;
		}
	}

	private static binaryToBuffer(binaryData: any): Buffer {
		return Buffer.from(binaryData.data, 'base64');
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const item = items[i];

				const folderPath = this.getNodeParameter('folderPath', i) as string;
				const inputMode = this.getNodeParameter('inputMode', i) as string;
				let baseFileName = this.getNodeParameter('baseFileName', i, 'file') as string;
				let fileExtension = this.getNodeParameter('fileExtension', i, '') as string;

				// Get optional parameters from the collection
				const additionalOptions = this.getNodeParameter('additionalOptions', i, {}) as any;
				const createFolders = additionalOptions.createFolders ?? true;
				const overwrite = additionalOptions.overwrite ?? false;
				const pattern = additionalOptions.customPattern ?? '{base}_{counter}';
				const counterStart = additionalOptions.counterStart ?? 1;
				const counterPadding = additionalOptions.counterPadding ?? 3;

				let buffer: Buffer;

				if (createFolders) {
					await fs.mkdir(folderPath, { recursive: true });
				}

				if (inputMode === 'binary') {
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;

					if (item.binary === undefined || item.binary[binaryPropertyName] === undefined) {
						throw new NodeOperationError(
							this.getNode(),
							`No binary property '${binaryPropertyName}' found on item ${i}.`,
						);
					}

					const binaryData = item.binary[binaryPropertyName];
					buffer = SaveFile.binaryToBuffer(binaryData);

					// Get filename if not present
					if (!baseFileName) {
						if (binaryData.fileName) {
							baseFileName = path.parse(binaryData.fileName).name;
						} else {
							baseFileName = 'file';
						}
					}

					// Get file extension if not present
					if (!fileExtension) {
						if (binaryData.fileName) {
							fileExtension = path.parse(binaryData.fileName).ext.substring(1);
						} else {
							fileExtension = 'bin';
						}
					}
				} else {
					// text mode
					let textData = this.getNodeParameter('dataField', i);

					if (typeof textData !== 'string') {
						textData = JSON.stringify(textData, null, 2);

						if (!fileExtension) {
							fileExtension = 'json';
						}
					} else {
						textData = textData;

						if (!fileExtension) {
							fileExtension = 'txt';
						}
					}

					buffer = Buffer.from(textData, 'utf8');
				}

				const sanitizedBase = SaveFile.sanitizeFilename(baseFileName);

				const savedPath = await SaveFile.findAndWrite(
					folderPath,
					pattern,
					sanitizedBase,
					counterStart,
					counterPadding,
					fileExtension,
					buffer,
					overwrite,
				);

				returnData.push({
					json: {
						...item.json,
						savedFilePath: savedPath,
					},
					binary: item.binary,
					pairedItem: {
						item: i,
					},
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
						},
						pairedItem: {
							item: i,
						},
					});
					continue;
				}
				throw error;
			}
		}

		return this.prepareOutputData(returnData);
	}
}
