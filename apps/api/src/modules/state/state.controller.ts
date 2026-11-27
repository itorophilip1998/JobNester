import { Controller, Get, Inject } from "@nestjs/common";
import { AppService } from "../workspace/workspace.service.js";

@Controller("api")
export class StateController {
  constructor(@Inject(AppService) private readonly service: AppService) {}

  @Get("state")
  state() {
    return this.service.state();
  }
}
