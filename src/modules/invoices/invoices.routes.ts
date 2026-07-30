import { Router } from "express";
import { container } from "tsyringe";
import { InvoiceController } from "./invoices.controller.js";
import { validate } from "../../middleware/validate.middleware.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { scopeTenant } from "../../middleware/tenant.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { createInvoiceLimiter, addPaymentLimiter } from "../../middleware/rate-limit.middleware.js";
import {
  createInvoiceSchema,
  listInvoicesSchema,
  invoiceIdParamSchema,
  addPaymentSchema,
} from "./invoices.validation.js";

const invoiceController = container.resolve(InvoiceController);
const router = Router();

router.use(authenticate, scopeTenant);

router.get("/", authorize("invoices.read"), validate(listInvoicesSchema), invoiceController.list);
router.get("/:id", authorize("invoices.read"), validate(invoiceIdParamSchema), invoiceController.getById);
router.post("/", createInvoiceLimiter, authorize("invoices.create"), validate(createInvoiceSchema), invoiceController.create);
router.post("/:id/payments", addPaymentLimiter, authorize("invoices.update"), validate(invoiceIdParamSchema), validate(addPaymentSchema), invoiceController.addPayment);
router.post("/:id/cancel", authorize("invoices.cancel"), validate(invoiceIdParamSchema), invoiceController.cancel);

export default router;
