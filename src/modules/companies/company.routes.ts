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
  lookupCompanySchema,
  joinCompanySchema,
  joinRequestActionSchema,
  regenerateInviteCodeSchema,
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

// Join flow — public (auth only, no tenant scope)
router.get('/lookup', validate(lookupCompanySchema), companyController.lookupCompany);
router.post('/join', validate(joinCompanySchema), companyController.requestJoin);
router.get('/my-join-requests', companyController.getMyJoinRequests);

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

// Join request management (owner/admin)
router.get('/:id/join-requests', companyController.listJoinRequests);
router.post('/:id/join-requests/:requestId/approve', validate(joinRequestActionSchema), companyController.approveJoinRequest);
router.post('/:id/join-requests/:requestId/reject', validate(joinRequestActionSchema), companyController.rejectJoinRequest);

// Invite code management (owner only)
router.post('/:id/invite-code/regenerate', validate(regenerateInviteCodeSchema), companyController.regenerateInviteCode);

export default router;
