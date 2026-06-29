export interface OpenAiModelCatalogEntry {
  modelId: string;
  inputPrice: number;
  cachedInputPrice: number | null;
  outputPrice: number;
}

export const OPENAI_MODEL_CATALOG: OpenAiModelCatalogEntry[] = [
  { modelId: "gpt-5.2", inputPrice: 1.75, cachedInputPrice: 0.175, outputPrice: 14.0 },
  { modelId: "gpt-5.2-pro", inputPrice: 21.0, cachedInputPrice: null, outputPrice: 168.0 },
  { modelId: "gpt-5.1", inputPrice: 1.25, cachedInputPrice: 0.125, outputPrice: 10.0 },
  { modelId: "gpt-5", inputPrice: 1.25, cachedInputPrice: 0.125, outputPrice: 10.0 },
  { modelId: "gpt-5-mini", inputPrice: 0.25, cachedInputPrice: 0.025, outputPrice: 2.0 },
  { modelId: "gpt-5-nano", inputPrice: 0.05, cachedInputPrice: 0.005, outputPrice: 0.4 },
  { modelId: "gpt-5-pro", inputPrice: 15.0, cachedInputPrice: null, outputPrice: 120.0 },
  { modelId: "gpt-4.1", inputPrice: 2.0, cachedInputPrice: 0.5, outputPrice: 8.0 },
  { modelId: "gpt-4.1-mini", inputPrice: 0.4, cachedInputPrice: 0.1, outputPrice: 1.6 },
  { modelId: "gpt-4.1-nano", inputPrice: 0.1, cachedInputPrice: 0.025, outputPrice: 0.4 },
  { modelId: "gpt-4o", inputPrice: 2.5, cachedInputPrice: 1.25, outputPrice: 10.0 },
  { modelId: "gpt-4o-mini", inputPrice: 0.15, cachedInputPrice: 0.075, outputPrice: 0.6 },
  { modelId: "o4-mini", inputPrice: 1.1, cachedInputPrice: 0.275, outputPrice: 4.4 },
  { modelId: "o3", inputPrice: 2.0, cachedInputPrice: 0.5, outputPrice: 8.0 },
  { modelId: "o3-mini", inputPrice: 1.1, cachedInputPrice: 0.55, outputPrice: 4.4 },
  { modelId: "o3-pro", inputPrice: 20.0, cachedInputPrice: null, outputPrice: 80.0 },
  { modelId: "o1", inputPrice: 15.0, cachedInputPrice: 7.5, outputPrice: 60.0 },
  { modelId: "o1-mini", inputPrice: 1.1, cachedInputPrice: 0.55, outputPrice: 4.4 },
  { modelId: "o1-pro", inputPrice: 150.0, cachedInputPrice: null, outputPrice: 600.0 },
  { modelId: "gpt-4o-2024-05-13", inputPrice: 5.0, cachedInputPrice: null, outputPrice: 15.0 },
  { modelId: "gpt-4-turbo-2024-04-09", inputPrice: 10.0, cachedInputPrice: null, outputPrice: 30.0 },
  { modelId: "gpt-4-0125-preview", inputPrice: 10.0, cachedInputPrice: null, outputPrice: 30.0 },
  { modelId: "gpt-4-1106-preview", inputPrice: 10.0, cachedInputPrice: null, outputPrice: 30.0 },
  { modelId: "gpt-4-1106-vision-preview", inputPrice: 10.0, cachedInputPrice: null, outputPrice: 30.0 },
  { modelId: "gpt-4-0613", inputPrice: 30.0, cachedInputPrice: null, outputPrice: 60.0 },
  { modelId: "gpt-4-0314", inputPrice: 30.0, cachedInputPrice: null, outputPrice: 60.0 },
  { modelId: "gpt-4-32k", inputPrice: 60.0, cachedInputPrice: null, outputPrice: 120.0 },
  { modelId: "gpt-3.5-turbo", inputPrice: 0.5, cachedInputPrice: null, outputPrice: 1.5 },
  { modelId: "gpt-3.5-turbo-0125", inputPrice: 0.5, cachedInputPrice: null, outputPrice: 1.5 },
  { modelId: "gpt-3.5-turbo-1106", inputPrice: 1.0, cachedInputPrice: null, outputPrice: 2.0 },
  { modelId: "gpt-3.5-turbo-0613", inputPrice: 1.5, cachedInputPrice: null, outputPrice: 2.0 },
  { modelId: "gpt-3.5-0301", inputPrice: 1.5, cachedInputPrice: null, outputPrice: 2.0 },
  { modelId: "gpt-3.5-turbo-instruct", inputPrice: 1.5, cachedInputPrice: null, outputPrice: 2.0 },
  { modelId: "gpt-3.5-turbo-16k-0613", inputPrice: 3.0, cachedInputPrice: null, outputPrice: 4.0 },
  { modelId: "davinci-002", inputPrice: 2.0, cachedInputPrice: null, outputPrice: 2.0 },
  { modelId: "babbage-002", inputPrice: 0.4, cachedInputPrice: null, outputPrice: 0.4 },
];

function formatModelPrice(price: number): string {
  return price.toFixed(3).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

export function formatOpenAiModelPricing(entry: OpenAiModelCatalogEntry): string {
  const cachedPart = entry.cachedInputPrice === null ? "n/a" : formatModelPrice(entry.cachedInputPrice);

  return `${formatModelPrice(entry.inputPrice)} / ${cachedPart} / ${formatModelPrice(entry.outputPrice)}`;
}

