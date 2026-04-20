-- Add UPSCALE_IMAGE to the AiToolType enum so AiToolConfig + AiGeneration
-- rows can reference the new "upscale existing image" tool (Replicate
-- Real-ESRGAN).
ALTER TYPE "AiToolType" ADD VALUE 'UPSCALE_IMAGE';
