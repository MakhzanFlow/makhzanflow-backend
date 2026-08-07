import { Router } from 'express';
import { container } from 'tsyringe';
import { CompanyController } from './company.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  createCompanySchema,
  updateCompanySchema,
  addMemberSchema,
  updateMemberSchema,
} from './company.validation.js';

const companyController = container.resolve(CompanyController);

const router = Router();

// Apply authentication middleware to all company routes
router.use(authenticate);

// Company collection / base endpoints
router.post('/', validate(createCompanySchema), companyController.createCompany);
router.get('/', companyController.getUserCompanies);

// Permission catalog for the UI (must be registered before /:id routes)
router.get('/permissions', companyController.getPermissionCatalog);

// Individual company details management
router.get('/:id', companyController.getCompanyDetails);
router.patch('/:id', validate(updateCompanySchema), companyController.updateCompany);
router.delete('/:id', companyController.deleteCompany);

// Company membership management
router.get('/:id/members', companyController.listMembers);
router.post('/:id/members', validate(addMemberSchema), companyController.addMember);
router.patch('/:id/members/:userId', validate(updateMemberSchema), companyController.updateMember);
router.delete('/:id/members/:userId', companyController.removeMember);
router.get('/:id/members/:userId/permissions', companyController.getMemberPermissions);

export default router;
