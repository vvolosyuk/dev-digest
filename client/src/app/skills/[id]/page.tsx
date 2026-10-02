import { SkillsView } from "../_components/SkillsView";

/* Route: /skills/:id (selected skill; `new` opens the create form). Same view
   as /skills — SkillsView reads the id from the route params. */
export default function SkillPage() {
  return <SkillsView />;
}
