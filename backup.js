import { promises as fs } from 'fs';
import { join } from 'path';
import { OpenAI } from 'openai';
import { parse } from '@babel/parser';
import dotenv from 'dotenv';
import _traverse from '@babel/traverse';

dotenv.config();

// Configuration with expanded options
const config = {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    maxRetries: Number(process.env.MAX_RETRIES) || 3,
    supportedExtensions: process.env.SUPPORTED_EXTENSIONS?.split(',') || ['.js', '.jsx', '.ts', '.tsx'],
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    outputFormat: process.env.OUTPUT_FORMAT || 'jsdoc',
    dryRun: process.env.DRY_RUN === 'true'
};

class CodeDocumenter {
    constructor(apiKey) {
        this.openai = new OpenAI({
            apiKey: apiKey || config.openaiApiKey
        });
        this.documentationValidator = /\/\*\*[\s\S]*?\*\//;
    }

    async extractFunctions(code) {
        const functions = [];

        try {
            const ast = parse(code, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript']
            });

            const traverse = _traverse.default || _traverse;
            traverse(ast, {
                FunctionDeclaration(path) {
                    functions.push({
                        name: path.node.id.name,
                        code: code.slice(path.node.start, path.node.end),
                        start: path.node.start,
                        end: path.node.end
                    });
                },
                ArrowFunctionExpression(path) {
                    if (path.parent.type === 'VariableDeclarator') {
                        functions.push({
                            name: path.parent.id.name,
                            code: code.slice(path.node.start, path.node.end),
                            start: path.node.start,
                            end: path.node.end
                        });
                    }
                },
                ClassMethod(path) {
                    functions.push({
                        name: path.node.key.name,
                        code: code.slice(path.node.start, path.node.end),
                        start: path.node.start,
                        end: path.node.end
                    });
                },
                ObjectMethod(path) {
                    functions.push({
                        name: path.node.key.name,
                        code: code.slice(path.node.start, path.node.end),
                        start: path.node.start,
                        end: path.node.end
                    });
                }
            });

        } catch (error) {
            console.error('Error parsing code:', error);
            throw new Error('Failed to parse code: ' + error.message);
        }

        return functions;
    }

    async generateDocumentation(codeSnippet, docType) {
        const prompt = this.createPrompt(codeSnippet, docType);

        for (let i = 0; i < config.maxRetries; i++) {
            try {
                const completion = await this.openai.chat.completions.create({
                    model: config.model,
                    messages: [
                        {
                            role: "system",
                            content: "You are a technical documentation expert. Generate a clean JSDoc comment block. Do not include any backticks, language markers, or extra formatting. The comment must start with /** and end with */. Do not include any other text or formatting."
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.7
                });

                let documentation = completion.choices[0].message.content.trim();

                // Enhanced cleanup of the documentation
                documentation = documentation
                    // Remove any code block markers with or without language specification
                    .replace(/```[\s\S]*?```/g, '')
                    .replace(/```[\w]*\n?/g, '')
                    // Remove any remaining backticks
                    .replace(/`/g, '')
                    // Remove any double /** markers
                    .replace(/\/\*\*\s*\/\*\*/g, '/**')
                    // Remove any language markers that might appear at the start
                    .replace(/^(js|javascript)\s*/i, '')
                    // Ensure it starts with /**
                    .replace(/^(?!\s*\/\*\*)/, '/**')
                    // Ensure it ends with */
                    .replace(/(?<!\*\/)\s*$/, '*/');

                if (this.validateDocumentation(documentation)) {
                    return documentation;
                }
                console.log('Retrying due to invalid documentation format...');
            } catch (error) {
                if (i === config.maxRetries - 1) {
                    throw new Error(`Failed to generate documentation after ${config.maxRetries} attempts: ${error.message}`);
                }
                console.log(`Attempt ${i + 1} failed, retrying...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }

        throw new Error('Failed to generate documentation');
    }

    validateDocumentation(documentation) {
        // More lenient validation
        if (!documentation.trim().startsWith('/**')) {
            console.log('Documentation must start with /**');
            return false;
        }
        if (!documentation.trim().endsWith('*/')) {
            console.log('Documentation must end with */');
            return false;
        }
        return true;
    }

    createPrompt(codeSnippet, docType, functionInfo = null) {
        const format = config.outputFormat.toUpperCase();

        if (docType === 'file') {
            return `Generate a professional ${format} file-level documentation comment for this code:
                ${codeSnippet}
                Include:
                - Brief description of the file's purpose
                - Main components/functions
                - Any important notes or dependencies
                Format as a ${format} comment block starting with /**`;
        } else {
            return `Generate a basic ${format} function documentation comment for this code:
                ${codeSnippet}
                Include:
                - Start with "${functionInfo?.name || ''}: " followed by the function description
                - @param tags with types and descriptions
                - @returns tag with type and description
                - @throws tag if applicable
                Format as a ${format} comment block starting with "/**"`;
        }
    }

    async processFile(filePath) {
        try {
            const code = await fs.readFile(filePath, 'utf8');

            // Generate file-level documentation
            const fileDoc = await this.generateDocumentation(code, 'file');

            // Extract and document functions
            const functions = await this.extractFunctions(code);
            const documentedFunctions = await Promise.all(
                functions.map(async func => {
                    const doc = await this.generateDocumentation(func.code, 'function');
                    return {
                        ...func,
                        documentation: doc
                    };
                })
            );

            // Create updated code
            let updatedCode = code;
            let offset = 0;

            // Add file-level documentation at the start
            if (fileDoc) {
                updatedCode = fileDoc + '\n\n' + updatedCode;
                offset = fileDoc.length + 2;
            }

            // Add function documentation
            for (const func of documentedFunctions) {
                const insertPosition = func.start + offset;
                updatedCode =
                    updatedCode.slice(0, insertPosition) +
                    func.documentation + '\n' +
                    updatedCode.slice(insertPosition);
                offset += func.documentation.length + 1;
            }

            // Write updated code back to file or show diff in dry run mode
            if (config.dryRun) {
                console.log(`\nDry run output for ${filePath}:`);
                console.log('-------------------');
                console.log(updatedCode);
                console.log('-------------------');
            } else {
                await fs.writeFile(filePath, updatedCode);
                console.log(`✓ Documented ${filePath}`);
            }
        } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
            throw error;
        }
    }

    async processDirectory(dirPath) {
        try {
            const files = await fs.readdir(dirPath);

            for (const file of files) {
                const fullPath = join(dirPath, file);
                const stat = await fs.stat(fullPath);

                if (stat.isDirectory()) {
                    await this.processDirectory(fullPath);
                } else if (config.supportedExtensions.some(ext => file.endsWith(ext))) {
                    await this.processFile(fullPath);
                }
            }
        } catch (error) {
            console.error(`Error processing directory ${dirPath}:`, error);
            throw error;
        }
    }
}

async function main() {
    const args = process.argv.slice(2);

    const usage = `
    Usage: node autoscribe.js <path> [options]
    
    Options:
        --dry-run           Show what would be generated without modifying files
        --api-key <key>     OpenAI API key (required if not in env)
        --recursive         Process directories recursively
        --model <model>     OpenAI model to use (default: gpt-4o)
        --format <format>   Documentation format (jsdoc|tsdoc)
    `;

    // Get the target path (first non-option argument)
    const targetPath = args.find(arg => !arg.startsWith('--'));
    if (!targetPath) {
        console.error('Error: Path argument is required');
        console.log(usage);
        process.exit(1);
    }

    // Parse command line arguments
    const options = {
        targetPath,
        apiKey: args.includes('--api-key') ? args[args.indexOf('--api-key') + 1] : config.openaiApiKey,
        recursive: args.includes('--recursive'),
        model: args.includes('--model') ? args[args.indexOf('--model') + 1] : config.model,
        format: args.includes('--format') ? args[args.indexOf('--format') + 1] : config.outputFormat,
        dryRun: args.includes('--dry-run')
    };

    if (!options.apiKey) {
        console.error('Error: OpenAI API key is required');
        console.log(usage);
        process.exit(1);
    }

    // Update config with command line options
    Object.assign(config, {
        openaiApiKey: options.apiKey,
        model: options.model,
        outputFormat: options.format,
        dryRun: options.dryRun
    });

    const documenter = new CodeDocumenter(options.apiKey);

    try {
        const stats = await fs.stat(options.targetPath);

        if (stats.isFile()) {
            await documenter.processFile(options.targetPath);
        } else if (stats.isDirectory() && options.recursive) {
            await documenter.processDirectory(options.targetPath);
        } else if (stats.isDirectory()) {
            console.error('Error: Use --recursive flag to process directories');
            process.exit(1);
        }

        console.log('✅ Documentation complete!');
        console.log('...please allow a few seconds for the file to update');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

if (import.meta.url === import.meta.resolve(process.argv[1])) {
    await main();
}

export default CodeDocumenter;

