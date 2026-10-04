// domain → Node.js 組み込みモジュール（違反）
import { readFileSync } from 'node:fs';
// domain → electron（違反）
import { app } from 'electron';
// domain → application（違反）
import { sampleUseCase } from '../../application/usecases/sample.usecase';

export const sampleModel = [readFileSync, app, sampleUseCase];
