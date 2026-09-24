import { Router } from 'express';
import { container } from 'tsyringe';
import { CustomerController } from './customers.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { scopeTenant } from '../../middleware/tenant.middleware.js';
import { authorize } from '../../middleware/authorize.middleware.js';
import { uploadImage } from '../../middleware/upload.middleware.js';
import {
  createCustomerSchema,
  updateCustomerSchema,
  listCustomersSchema,
  debtorsListSchema,
  customerIdParamSchema,
  customerTransactionsQuerySchema,
} from './customers.validation.js';

const customerController = container.resolve(CustomerController);

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
router.put('/:id', authorize('customers.update'), validate(customerIdParamSchema), validate(updateCustomerSchema), customerController.update);
router.post('/:id/image', authorize('customers.update'), validate(customerIdParamSchema), uploadImage.single('image'), customerController.uploadImage);
router.delete('/:id', authorize('customers.delete'), validate(customerIdParamSchema), customerController.delete);

export default router;
