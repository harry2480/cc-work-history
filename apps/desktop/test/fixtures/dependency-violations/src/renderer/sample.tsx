// renderer → Node.js 組み込みモジュール（違反）
import { readFileSync } from 'node:fs';
// renderer → main（違反）
import { sampleLoader } from '../main/backend/presentation/loaders/sample.loader';

export const sample = [readFileSync, sampleLoader];
