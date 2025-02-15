import { promises as fs } from 'fs';
import { join } from 'path';
import { OpenAI } from 'openai';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import 'dotenv/config';

const config = {
    openaiApiKey: process.env.OPENAI_API_KEY,
    maxRetries: process.env.MAX_RETRIES || 3,
    supportedExtensions: process.env.SUPPORTED_EXTENSIONS?.split(',') || ['.js', '.jsx', '.ts']
};