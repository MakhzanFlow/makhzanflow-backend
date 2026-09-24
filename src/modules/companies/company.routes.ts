import { Router } from 'express';
import { container } from 'tsyringe';
import { CompanyController } from './company.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { lookupLimiter, joinLimiter } from '../../middleware/rate-limit.middleware.js';
import {
  createCompanySchema,
  updateCompanySchema,
  addMemberSchema,
  updateMemberSchema,
  lookupCompanySchema,
  joinCompanySchema,
  joinRequestActionSchema,
  regenerateInviteCodeSchema,
  companyIdParamSchema,
  memberPermissionsParamSchema,
  listMembersSchema,
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
router.get('/lookup', lookupLimiter, validate(lookupCompanySchema), companyController.lookupCompany);
router.post('/join', joinLimiter, validate(joinCompanySchema), companyController.requestJoin);
router.get('/my-join-requests', companyController.getMyJoinRequests);

// Individual company details management
router.get('/:id', validate(companyIdParamSchema), companyController.getCompanyDetails);
router.patch('/:id', validate(companyIdParamSchema), validate(updateCompanySchema), companyController.updateCompany);
router.delete('/:id', validate(companyIdParamSchema), companyController.deleteCompany);
router.post('/:id/restore', validate(companyIdParamSchema), companyController.restoreCompany);

// Company membership management
router.get('/:id/members', validate(listMembersSchema), companyController.listMembers);
router.post('/:id/members', validate(addMemberSchema), companyController.addMember);
router.patch('/:id/members/:userId', validate(updateMemberSchema), companyController.updateMember);
router.delete('/:id/members/:userId', validate(memberPermissionsParamSchema), companyController.removeMember);
router.get('/:id/members/:userId/permissions', validate(memberPermissionsParamSchema), companyController.getMemberPermissions);

// Join request management (owner/admin)
router.get('/:id/join-requests', validate(companyIdParamSchema), companyController.listJoinRequests);
router.post('/:id/join-requests/:requestId/approve', validate(joinRequestActionSchema), companyController.approveJoinRequest);
router.post('/:id/join-requests/:requestId/reject', validate(joinRequestActionSchema), companyController.rejectJoinRequest);

// Invite code management (owner only)
router.post('/:id/invite-code/regenerate', validate(regenerateInviteCodeSchema), companyController.regenerateInviteCode);

export default router;
