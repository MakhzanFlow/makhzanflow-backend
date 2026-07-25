import type { Response, NextFunction } from 'express';
import type { TenantRequest } from '../../middleware/tenant.middleware.js';
import { CustomerService } from './customers.service.js';
import { CustomerRepository } from './customers.repository.js';
import type { TFunction } from 'i18next';

const customerRepo = new CustomerRepository();
const customerService = new CustomerService(customerRepo);

export class CustomerController {
  async create(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const customer = await customerService.create({
        ...req.body,
        company_id: req.companyId!,
      });
      const t = req.t as TFunction;
      res.status(201).json({
        success: true,
        message: t ? t('customers.created') : 'Customer created successfully',
        data: customer,
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const page = req.query.page;
      const limit = req.query.limit;
      const search = req.query.search;
      const sort = req.query.sort;
      const order = req.query.order;
      const debt_status = req.query.debt_status;
      const result = await customerService.list({
        companyId: req.companyId!,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
        ...(search ? { search: String(search) } : {}),
        ...(sort ? { sort: String(sort) } : {}),
        ...(order ? { order: String(order) } : {}),
        ...(debt_status ? { debt_status: String(debt_status) } : {}),
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
      const customer = await customerService.findById(id, req.companyId!);
      res.status(200).json({
        success: true,
        data: customer,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const file = req.file;

      const name = req.body.name;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        const t = req.t as TFunction;
        res.status(400).json({
          success: false,
          message: t ? t('validation.nameRequired') : 'Name is required',
        });
        return;
      }

      const imageUrl = file ? `/uploads/customers/${file.filename}` : undefined;
      const customer = await customerService.update(id, req.companyId!, {
        name: name.trim(),
        phone: req.body.phone ?? null,
        email: req.body.email ?? null,
        address: req.body.address ?? null,
      }, imageUrl);

      const t = req.t as TFunction;
      res.status(200).json({
        success: true,
        message: t ? t('customers.updated') : 'Customer updated successfully',
        data: customer,
      });
    } catch (error) {
      next(error);
    }
  }


  async delete(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await customerService.delete(id, req.companyId!);
      const t = req.t as TFunction;
      res.status(200).json({
        success: true,
        message: t ? t('customers.deleted') : 'Customer deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getDebt(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const debt = await customerService.getDebt(id, req.companyId!);
      res.status(200).json({
        success: true,
        data: debt,
      });
    } catch (error) {
      next(error);
    }
  }

  async getSummary(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const summary = await customerService.getSummary(req.companyId!);
      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  async getDebtors(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      const search = req.query.search;
      const result = await customerService.getDebtors({
        companyId: req.companyId!,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
        ...(search ? { search: String(search) } : {}),
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

export const customerController = new CustomerController();
