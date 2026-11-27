import { Body, Controller, Inject, Param, Post } from "@nestjs/common";
import { AppService } from "../workspace/workspace.service.js";

@Controller("api")
export class ActionsController {
  constructor(@Inject(AppService) private readonly service: AppService) {}

  @Post("actions/:action")
  action(@Param("action") action: string, @Body() data: unknown) {
    return this.service.action(action, data);
  }
}
