# n8n-nodes-better-save

This is an n8n community node that provides advanced file saving capabilities. It lets you save files with flexible naming patterns, atomic operations, and robust error handling in your n8n workflows.

The Better Save node extends n8n's built-in file operations with features like automatic counter-based naming, custom filename patterns, race-condition prevention, and support for both binary and text data.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Features](#features)
[Compatibility](#compatibility)
[Usage](#usage)
[Configuration](#configuration)
[Examples](#examples)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

### NPM Installation

```bash
npm install n8n-nodes-better-save
```

### Manual Installation

1. Clone this repository or download the dist files
2. Copy the `dist` folder to your n8n custom nodes directory (`~/.n8n/custom/`)
3. Restart n8n

## Operations

The Better Save node provides a single operation:

- **Save File (Advanced)**: Saves binary or text/JSON data to files with advanced naming and overwrite options

## Features

### **Core Capabilities**

- **Dual Data Mode Support**: Save both binary data and text/JSON data

### **File Naming Features**

- **Smart Defaults**: Auto-detect file extensions and base names from binary data
- **Folder Management**: Automatically create destination directories
- **Pattern Tokens**: Use `{base}` and `{counter}` tokens in custom patterns
- **Auto-Incrementing**: Automatic counter with configurable start value and zero-padding

### **Safety Features**

- **Race-Condition Safe**: Uses atomic file operations to prevent conflicts in concurrent workflows
- **Overwrite Control**: Choose whether to overwrite existing files or create new ones
- **Filename Sanitization**: Removes invalid characters and handles cross-platform compatibility

## Compatibility

- **Tested with**: n8n 1.102.4
- **Platform support**: Windows, macOS, Linux

## Usage

### Basic File Saving

1. Add the "Save File (Advanced)" node to your workflow
2. Configure the required parameters:
   - **Folder Path**: Where to save files (e.g., `/data/files`)
   - **Input Data Mode**: Choose "Binary" or "Text/JSON"
   - **Base Filename**: Base name for your files
3. Optionally configure advanced options in the "Additional Options" collection

### Working with Binary Data

When saving binary data (files, images, documents):

- Set **Input Data Mode** to "Binary"
- Specify the **Binary Property Name** (usually "data")
- The node will auto-detect filename and extension from binary metadata

### Working with Text/JSON Data

When saving text or JSON data:

- Set **Input Data Mode** to "Text/JSON"
- Choose **From Field**: Saves data from a specific field

## Configuration

### Required Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| **Folder Path** | Destination directory for saved files | `/tmp/n8n-files` |
| **Input Data Mode** | Type of data to save (Binary/Text) | `Binary` |
| **Base Filename** | Base name for output files | `document` |
| **File Extension** | File extension (auto-detected if empty) | `pdf` |

### Additional Options (Optional)

| Parameter | Default | Description |
|-----------|---------|-------------|
| **Create Folders** | `true` | Create destination directory if it doesn't exist |
| **Overwrite Existing File** | `false` | Overwrite files or create new ones with incremented names |
| **Custom Pattern** | `{base}_{counter}` | Filename pattern using tokens |
| **Counter Start** | `1` | Starting number for the counter |
| **Counter Padding** | `3` | Number of zeros to pad the counter |

### Pattern Tokens

- `{base}`: Replaced with the base filename
- `{counter}`: Replaced with the auto-incrementing counter (with padding)

## Examples

### Example 1: Save PDF Files with Auto-Incrementing Names

```txt
Input: Binary PDF data
Configuration:
- Folder Path: /documents/pdf
- Input Data Mode: Binary
- Base Filename: report
- Custom Pattern: {base}_{counter}
- Counter Padding: 3

Output: report_001.pdf, report_002.pdf, report_003.pdf, ...
```

### Example 2: Save JSON Data from API Response

```txt
Input: JSON object from API
Configuration:
- Folder Path: /data/exports
- Input Data Mode: Text/JSON
- Source for Text Data: Full JSON
- Base Filename: api_response
- File Extension: json

Output: api_response_001.json, api_response_002.json, ...
```

### Example 3: Save Specific Field as Text File

```txt
Input: JSON with "content" field
Configuration:
- Folder Path: /exports/text
- Input Data Mode: Text/JSON
- Source for Text Data: From Field
- Source Field: content
- Base Filename: extracted_content
- File Extension: txt

Output: extracted_content_001.txt, extracted_content_002.txt, ...
```

### Example 4: Custom Naming Pattern

```txt
Configuration:
- Custom Pattern: backup_{base}_{counter}_final
- Base Filename: data
- Counter Start: 100
- Counter Padding: 4

Output: backup_data_0100_final.json, backup_data_0101_final.json, ...
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
