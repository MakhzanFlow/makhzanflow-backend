import { Router } from "express";
import { container } from "tsyringe";
import { ProductController } from "./products.controller.js";
import { validate } from "../../middleware/validate.middleware.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { scopeTenant } from "../../middleware/tenant.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { uploadImage } from "../../middleware/upload.middleware.js";
import {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
  productIdParamSchema,
} from "./products.validation.js";
import { createProductLimiter } from "../../middleware/rate-limit.middleware.js";

const productController = container.resolve(ProductController);

const router = Router();

router.use(authenticate, scopeTenant);

router.get("/", authorize("products.read"), validate(listProductsSchema), productController.list);
router.get("/:id", authorize("products.read"), validate(productIdParamSchema), productController.getById);
router.post("/", createProductLimiter, authorize("products.create"), validate(createProductSchema), productController.create);
router.put("/:id", authorize("products.update"), validate(productIdParamSchema), validate(updateProductSchema), productController.update);
router.delete("/:id", authorize("products.delete"), validate(productIdParamSchema), productController.delete);
router.post("/:id/image", authorize("products.update"), validate(productIdParamSchema), uploadImage.single("image"), productController.uploadImage);
router.get("/:id/activity-logs", authorize("products.read"), validate(productIdParamSchema), productController.getActivityLogs);

export default router;
