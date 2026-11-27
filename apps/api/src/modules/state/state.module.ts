import { Module } from "@nestjs/common";
import { StateController } from "./state.controller.js";

@Module({ controllers: [StateController] })
export class StateModule {}
