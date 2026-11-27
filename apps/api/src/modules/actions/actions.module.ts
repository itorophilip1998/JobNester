import { Module } from "@nestjs/common";
import { ActionsController } from "./actions.controller.js";

@Module({ controllers: [ActionsController] })
export class ActionsModule {}
