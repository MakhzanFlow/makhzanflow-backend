import { Router } from "express";
import { container } from "tsyringe";
import { ProductController } from "./products.controller.js";
import { ActivityLogController } from "../activity-logs/activity-logs.controller.js";
import { validate } from "../../middleware/validate.middleware.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { scopeTenant } from "../../middleware/tenant.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
  productIdParamSchema,
} from "./products.validation.js";
import multer from "multer";
import { AppError } from "../../shared/errors/app-error.js";
import { createProductLimiter } from "../../middleware/rate-limit.middleware.js";

const productController = container.resolve(ProductController);
const activityLogController = container.resolve(ActivityLogController);

const storage = multer.memoryStorage();

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(400, "Invalid file type. Allowed: jpg, jpeg, png, webp", "errors.invalidFileType"));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = Router();

router.use(authenticate, scopeTenant);

router.get("/", authorize("products.read"), validate(listProductsSchema), productController.list);
router.get("/:id", authorize("products.read"), validate(productIdParamSchema), productController.getById);
router.post("/", createProductLimiter, authorize("products.create"), validate(createProductSchema), productController.create);
router.put("/:id", authorize("products.update"), validate(updateProductSchema), productController.update);
router.delete("/:id", authorize("products.delete"), validate(productIdParamSchema), productController.delete);
router.post("/:id/image", authorize("products.update"), upload.single("image"), productController.uploadImage);
router.get("/:id/activity-logs", authorize("products.read"), (req, res, next) => {
  req.params.entity = "product";
  req.params.entityId = req.params.id!;
  activityLogController.getByEntity(req, res, next);
});

export default router;
