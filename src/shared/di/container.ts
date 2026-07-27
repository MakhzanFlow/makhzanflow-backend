import { container } from "tsyringe";
import { ProductRepository } from "../../modules/products/products.repository.js";
import { ProductService } from "../../modules/products/products.service.js";
import { ProductController } from "../../modules/products/products.controller.js";
import { ActivityLogRepository } from "../../modules/activity-logs/activity-logs.repository.js";
import { ActivityLogService } from "../../modules/activity-logs/activity-logs.service.js";
import { ActivityLogController } from "../../modules/activity-logs/activity-logs.controller.js";

container.registerSingleton(ProductRepository);
container.registerSingleton(ActivityLogRepository);
container.registerSingleton(ActivityLogService);
container.registerSingleton(ProductService);
container.registerSingleton(ProductController);
container.registerSingleton(ActivityLogController);
