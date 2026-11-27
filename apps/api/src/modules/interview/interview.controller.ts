import {
  Controller,
  Get,
  Inject,
  Param,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Job, Profile } from "@jobnester/core";
import { AppService } from "../workspace/workspace.service.js";
import { db } from "../../common/prisma.js";
import { aiRequest, interviewResponse } from "../../ai/ai-client.js";

@Controller("api")
export class InterviewController {
  constructor(@Inject(AppService) private readonly service: AppService) {}

  @Get("interview/:id")
  async interview(@Param("id") id: string) {
    const [record, owner] = await Promise.all([
      db.job.findUniqueOrThrow({ where: { id } }),
      this.service.owner(),
    ]);
    const job = record.payload as unknown as Job;
    const p = owner.profile as unknown as Profile;
    try {
      return await aiRequest(
        "/v1/interviews/prepare",
        { profile: p, job },
        interviewResponse,
      );
    } catch (error) {
      throw new ServiceUnavailableException(
        error instanceof Error ? error.message : "AI service unavailable",
      );
    }
  }
}
