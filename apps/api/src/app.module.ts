import { Module } from "@nestjs/common";
import { WorkspaceModule } from "./modules/workspace/workspace.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { StateModule } from "./modules/state/state.module.js";
import { ActionsModule } from "./modules/actions/actions.module.js";
import { TasksModule } from "./modules/tasks/tasks.module.js";
import { ResumesModule } from "./modules/resumes/resumes.module.js";
import { PortfolioModule } from "./modules/portfolio/portfolio.module.js";
import { AssetsModule } from "./modules/assets/assets.module.js";
import { InterviewModule } from "./modules/interview/interview.module.js";
import { IntegrationsModule } from "./modules/integrations/integrations.module.js";

@Module({
  imports: [
    WorkspaceModule,
    HealthModule,
    StateModule,
    ActionsModule,
    TasksModule,
    ResumesModule,
    PortfolioModule,
    AssetsModule,
    InterviewModule,
    IntegrationsModule,
  ],
})
export class AppModule {}
