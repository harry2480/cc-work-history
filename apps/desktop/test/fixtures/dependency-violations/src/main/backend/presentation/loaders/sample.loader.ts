// presentation/loaders → domain（違反）
import { sampleModel } from '../../domain/models/sample.model';
// presentation/loaders → infrastructure（違反）
import { sampleAdapter } from '../../infrastructure/adapters/sample.adapter';

export const sampleLoader = [sampleModel, sampleAdapter];
