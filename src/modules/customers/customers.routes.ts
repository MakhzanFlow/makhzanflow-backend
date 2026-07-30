import { Router } from 'express';
import { customerController } from './customers.controller.js';
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
import path from 'path';
import { AppError } from '../../shared/errors/app-error.js';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, 'uploads/customers');
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
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
router.delete('/:id', authorize('customers.delete'), validate(customerIdParamSchema), customerController.delete);

export default router;
