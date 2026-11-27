import { Controller, Get, Param } from "@nestjs/common";
import { db } from "../../common/prisma.js";

@Controller("api")
export class TasksController {
  @Get("tasks/:id")
  task(@Param("id") id: string) {
    return db.task.findUniqueOrThrow({ where: { id } });
  }
}
