import { Router } from 'express';
import { container } from 'tsyringe';
import { CustomerController } from './customers.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { scopeTenant } from '../../middleware/tenant.middleware.js';
import { authorize } from '../../middleware/authorize.middleware.js';
import {
  createCustomerSchema,
  updateCustomerSchema,
  listCustomersSchema,
  debtorsListSchema,
  customerIdParamSchema,
  customerTransactionsQuerySchema,
} from './customers.validation.js';
import multer from 'multer';
import { AppError } from '../../shared/errors/app-error.js';

const customerController = container.resolve(CustomerController);

const storage = multer.memoryStorage();

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(400, 'Invalid file type. Allowed: jpg, jpeg, png, webp', 'errors.invalidFileType'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = Router();

router.use(authenticate, scopeTenant);

router.get('/', authorize('customers.read'), validate(listCustomersSchema), customerController.list);
router.get('/summary', authorize('customers.read'), customerController.getSummary);
router.get('/debtors', authorize('customers.read'), validate(debtorsListSchema), customerController.getDebtors);
router.get('/:id', authorize('customers.read'), validate(customerIdParamSchema), customerController.getById);
router.get('/:id/debt', authorize('customers.read'), validate(customerIdParamSchema), customerController.getDebt);
router.get('/:id/invoices', authorize('customers.read'), validate(customerIdParamSchema), validate(customerTransactionsQuerySchema), customerController.getInvoices);
router.get('/:id/payments', authorize('customers.read'), validate(customerIdParamSchema), validate(customerTransactionsQuerySchema), customerController.getPayments);
router.post('/', authorize('customers.create'), validate(createCustomerSchema), customerController.create);
router.put('/:id', authorize('customers.update'), upload.single('image'), customerController.update);
router.post('/:id/image', authorize('customers.update'), upload.single('image'), customerController.uploadImage);
router.delete('/:id', authorize('customers.delete'), validate(customerIdParamSchema), customerController.delete);

export default router;
