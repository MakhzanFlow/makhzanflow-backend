import { injectable, inject } from "tsyringe";
import type { Response, NextFunction } from "express";
import type { TenantRequest } from "../../middleware/tenant.middleware.js";
import { ProductService } from "./products.service.js";
import type { TFunction } from "i18next";

@injectable()
export class ProductController {
  constructor(@inject(ProductService) private productService: ProductService) {
    this.create = this.create.bind(this);
    this.list = this.list.bind(this);
    this.getById = this.getById.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
    this.uploadImage = this.uploadImage.bind(this);
    this.getActivityLogs = this.getActivityLogs.bind(this);
  }

  async create(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const product = await this.productService.create({
        ...req.body,
        company_id: req.companyId!,
      }, req.user?.id ?? "");
      const t = req.t as TFunction;
      res.status(201).json({
        success: true,
        message: t ? t("products:created") : "Product created successfully",
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const result = await this.productService.list({
        companyId: req.companyId!,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
        ...(req.query.search ? { search: String(req.query.search) } : {}),
        ...(req.query.sort ? { sort: String(req.query.sort) } : {}),
        ...(req.query.order ? { order: String(req.query.order) } : {}),
        ...(req.query.low_stock !== undefined ? { low_stock: req.query.low_stock === "true" } : {}),
        ...(req.query.expiry_before ? { expiry_before: String(req.query.expiry_before) } : {}),
        ...(req.query.expiry_after ? { expiry_after: String(req.query.expiry_after) } : {}),
        ...(req.query.is_active !== undefined ? { is_active: req.query.is_active === "true" } : {}),
      });
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const product = await this.productService.findById(id, req.companyId!);
      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const product = await this.productService.update(id, req.companyId!, {
        ...req.body,
      }, req.user?.id ?? "");
      const t = req.t as TFunction;
      res.status(200).json({
        success: true,
        message: t ? t("products:updated") : "Product updated successfully",
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await this.productService.delete(id, req.companyId!, req.user?.id ?? "");
      const t = req.t as TFunction;
      res.status(200).json({
        success: true,
        message: result.softDeleted
          ? t ? t("products:deactivated") : "Product deactivated successfully (has invoice references)"
          : t ? t("products:deleted") : "Product deleted successfully",
        data: result.softDeleted
          ? { softDeleted: true, product: result.product }
          : { softDeleted: false },
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadImage(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;

      if (!req.file) {
        const t = req.t as TFunction;
        res.status(400).json({
          success: false,
          message: t ? t("products:imageRequired") : "Image file is required",
          errors: [],
        });
        return;
      }

      const product = await this.productService.uploadImageWithBuffer(id, req.companyId!, req.file.buffer, req.user?.id ?? "");
      const t = req.t as TFunction;

      res.status(200).json({
        success: true,
        message: t ? t("products:imageUploaded") : "Image uploaded successfully",
        data: { image_url: product.image_url },
      });
    } catch (error) {
      next(error);
    }
  }

  async getActivityLogs(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await this.productService.getActivityLogs(id, req.companyId!, {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      });
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
}
