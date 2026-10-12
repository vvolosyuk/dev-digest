ALTER TABLE "skill_versions" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "skill_versions" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "skill_versions" ADD COLUMN "type" text;--> statement-breakpoint
ALTER TABLE "skill_versions" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_skills" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "skills_workspace_name_uq" ON "skills" USING btree ("workspace_id","name");