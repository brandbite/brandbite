-- Add BRIEF_PARSING to the AiToolType enum so AiToolConfig + AiGeneration
-- rows can reference the new "free text -> structured ticket draft" tool.
ALTER TYPE "AiToolType" ADD VALUE 'BRIEF_PARSING';
