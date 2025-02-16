# AutoScribe Documentation Generator

AutoScribe is an AI-powered documentation generator that automatically creates comprehensive JSDoc/TSDoc comments for your JavaScript and TypeScript code using GPT 4.o.

## Features

- Generates rich file-level and function-level documentation
- Processes individual files or entire directories recursively
- Supports JavaScript (.js), TypeScript (.ts), JSX (.jsx), and TSX (.tsx) files
- Maintains existing code structure while adding documentation
- Configurable through environment variables or command-line arguments
- Supports "dry-run" mode which outputs in terminal
- Handles various function types including:
  - Function declarations
  - Arrow functions
  - Class methods
  - Object methods

## Prerequisites

- Node.js (version 14 or higher recommended)
- OpenAI API key
- NPM or Yarn package manager

## Installation

1. Clone the repository:
```bash
git clone [https://github.com/adamchain/autoscribe.git]
cd [autoscribe]
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the project root:
```env
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4o
OUTPUT_FORMAT=jsdoc
SUPPORTED_EXTENSIONS=.js,.jsx,.ts,.tsx
MAX_RETRIES=3
DRY_RUN=false
```

## Usage

### Basic Usage

```bash
node autoscribe.js <path> --api-key <your-api-key>
```

### Command Line Options

- `--dry-run`: Generate documentation in terminal, without modifying files
- `--api-key <key>`: OpenAI API key (not required if key is in env)
- `--recursive`: Process directories recursively
- `--model <model>`: OpenAI model to use (default: gpt-4o)
- `--format <format>`: Documentation format (jsdoc|tsdoc)

### Examples

Document a single file:
```bash
node autoscribe.js ./src/component.js
```

Document an entire directory recursively:
```bash
node autoscribe.js ./src --recursive
```

Preview documentation without making changes:
```bash
node autoscribe.js ./src/component.js --dry-run
```

## Configuration

The tool can be configured through environment variables or command-line arguments:

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| OPENAI_API_KEY | Your OpenAI API key | Required |
| OPENAI_MODEL | GPT model to use | gpt-4o |
| OUTPUT_FORMAT | Documentation format | jsdoc |
| SUPPORTED_EXTENSIONS | File extensions to process | .js,.jsx,.ts,.tsx |
| MAX_RETRIES | Maximum retry attempts | 3 |
| DRY_RUN | Preview mode | false |

## Generated Documentation Format

The tool generates comprehensive documentation including:

### File-Level Documentation
- File purpose
- Main components/functions
- Important notes and dependencies

### Function-Level Documentation
- Function description
- Parameter types and descriptions
- Return value type and description
- Exception documentation when applicable

## Error Handling

- Retries failed API calls up to the configured maximum
- Validates generated documentation format
- Provides detailed error messages for troubleshooting
- Maintains original code if documentation generation fails

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

GPL-3.0 license

## Acknowledgments

- OpenAI for the brain
- Babel for AST parsing 

## Support

For issues, questions, or contributions, please [create an issue](your-repo-issues-url) in the repository.