import type { Response, NextFunction } from 'express';
import { CompanyService } from './company.service.js';
import { CompanyRepository } from './company.repository.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';

const companyRepository = new CompanyRepository();
const companyService = new CompanyService(companyRepository);

export class CompanyController {
  /**
   * Create a new company (logged-in user becomes Owner)
   */
  async createCompany(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerUserId = req.user.id;
      const company = await companyService.createCompany(req.body, ownerUserId);

      res.status(201).json({
        success: true,
        data: company,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get company details (requires membership)
   */
  async getCompanyDetails(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user.id;
      const id = req.params['id'] as string;
      const company = await companyService.getCompanyDetails(id, userId);

      res.status(200).json({
        success: true,
        data: company,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update company details
   */
  async updateCompany(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user.id;
      const id = req.params['id'] as string;
      const updated = await companyService.updateCompany(id, req.body, userId);

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete company
   */
  async deleteCompany(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user.id;
      const id = req.params['id'] as string;
      await companyService.deleteCompany(id, userId);

      res.status(200).json({
        success: true,
        message: 'Company deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all companies the authenticated user belongs to
   */
  async getUserCompanies(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user.id;
      const companies = await companyService.getUserCompanies(userId);

      res.status(200).json({
        success: true,
        data: companies,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List members of a company
   */
  async listMembers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user.id;
      const id = req.params['id'] as string;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await companyService.listMembers(id, userId, { page, limit });

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add a member to a company
   */
  async addMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const operatorUserId = req.user.id;
      const id = req.params['id'] as string;
      const { targetUserId, role, permissions } = req.body;

      const member = await companyService.addMember(id, targetUserId, role, permissions, operatorUserId);

      res.status(201).json({
        success: true,
        data: member,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a member's role or permissions
   */
  async updateMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const operatorUserId = req.user.id;
      const id = req.params['id'] as string;
      const userId = req.params['userId'] as string;

      const updated = await companyService.updateMember(id, userId, req.body, operatorUserId);

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove a member from a company
   */
  async removeMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const operatorUserId = req.user.id;
      const id = req.params['id'] as string;
      const userId = req.params['userId'] as string;

      await companyService.removeMember(id, userId, operatorUserId);

      res.status(200).json({
        success: true,
        message: 'Member removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const companyController = new CompanyController();
