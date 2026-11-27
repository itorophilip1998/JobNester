import { Global, Module } from "@nestjs/common";
import { AppService } from "./workspace.service.js";

@Global()
@Module({
  providers: [AppService],
  exports: [AppService],
})
export class WorkspaceModule {}
