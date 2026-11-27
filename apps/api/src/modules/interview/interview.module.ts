import { Module } from "@nestjs/common";
import { InterviewController } from "./interview.controller.js";

@Module({ controllers: [InterviewController] })
export class InterviewModule {}
