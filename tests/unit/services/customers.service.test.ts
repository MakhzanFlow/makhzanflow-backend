// import { describe, it, beforeEach, mock } from 'node:test';
// import assert from 'node:assert';
// import { CustomerService } from '../../../src/modules/customers/customers.service.js';
// import { CustomerRepository } from '../../../src/modules/customers/customers.repository.js';
// import { AppError } from '../../../src/shared/errors/app-error.js';

// const mockDecimal = (val: number) => ({ toString: () => val.toFixed(2) });

// const baseCustomer = {
//   id: 'cust-uuid-1',
//   company_id: 'company-uuid',
//   name: 'Acme Corp',
//   phone: '+1234567890',
//   email: 'contact@acme.com',
//   address: '123 Main St',
//   opening_balance: mockDecimal(500),
//   image_url: null,
//   created_at: new Date('2026-07-25'),
//   updated_at: new Date('2026-07-25'),
// };

// const baseCustomerNoBalance = { ...baseCustomer, opening_balance: mockDecimal(0) };

// function makeRepoStubs(): InstanceType<typeof CustomerRepository> {
//   const repo = new CustomerRepository();
//   for (const key of Object.getOwnPropertyNames(CustomerRepository.prototype)) {
//     if (key !== 'constructor') {
//       mock.method(repo, key as keyof CustomerRepository, async () => {});
//     }
//   }
//   return repo;
// }

// void describe('CustomerService', () => {
//   let repo: CustomerRepository;
//   let service: CustomerService;

//   beforeEach(() => {
//     repo = makeRepoStubs();
//     service = new CustomerService(repo);
//   });

//   void describe('create()', () => {
//     void it('creates customer with opening_balance = 0 (no invoice)', async () => {
//       const input = {
//         name: 'No Balance Co',
//         company_id: 'company-uuid',
//         opening_balance: 0,
//       };

//       const expected = { ...baseCustomerNoBalance, name: 'No Balance Co' };
//       (repo.create as any).mock.mockImplementation(async () => expected);

//       const result = await service.create(input);

//       assert.strictEqual(result.name, 'No Balance Co');
//       assert.strictEqual(result.current_debt, 0);
//       assert.strictEqual((repo.create as any).mock.callCount(), 1);
//       assert.strictEqual((repo.createCustomerAndInvoiceInTransaction as any).mock.callCount(), 0);
//     });

//     void it('creates customer with opening_balance > 0 and auto-creates invoice', async () => {
//       const input = {
//         name: 'Debtor Inc',
//         company_id: 'company-uuid',
//         opening_balance: 1000,
//       };

//       (repo.findLatestInvoiceNumber as any).mock.mockImplementation(async () => 'OB-20260725-0001');
//       (repo.createCustomerAndInvoiceInTransaction as any).mock.mockImplementation(
//         async (customerData: any, invoiceData: any) => ({
//           customer: { ...baseCustomer, name: 'Debtor Inc', opening_balance: mockDecimal(1000) },
//           invoice: {
//             id: 'inv-uuid',
//             invoice_number: invoiceData.invoice_number,
//             total_amount: mockDecimal(1000),
//             status: 'pending',
//           },
//         })
//       );

//       const result = await service.create(input);

//       assert.strictEqual(result.name, 'Debtor Inc');
//       assert.strictEqual(result.current_debt, 1000);
//       assert.ok(result.opening_balance_invoice);
//       assert.strictEqual(result.opening_balance_invoice!.total_amount, 1000);
//       assert.strictEqual(result.opening_balance_invoice!.status, 'pending');
//       assert.ok(result.opening_balance_invoice!.invoice_number.startsWith('OB-'));
//       assert.strictEqual((repo.create as any).mock.callCount(), 0);
//       assert.strictEqual((repo.createCustomerAndInvoiceInTransaction as any).mock.callCount(), 1);
//     });

//     void it('generates sequential invoice numbers', async () => {
//       const input = {
//         name: 'Seq Test',
//         company_id: 'company-uuid',
//         opening_balance: 100,
//       };

//       (repo.findLatestInvoiceNumber as any).mock.mockImplementation(async () => null);
//       (repo.createCustomerAndInvoiceInTransaction as any).mock.mockImplementation(
//         async (_cd: any, invData: any) => ({
//           customer: { ...baseCustomer, name: 'Seq Test', opening_balance: mockDecimal(100) },
//           invoice: {
//             id: 'inv-uuid',
//             invoice_number: invData.invoice_number,
//             total_amount: mockDecimal(100),
//             status: 'pending',
//           },
//         })
//       );

//       const result = await service.create(input);
//       assert.match(result.opening_balance_invoice!.invoice_number, /^OB-\d{8}-0001$/);
//     });
//   });

//   void describe('findById()', () => {
//     void it('returns customer detail with debt and transactions', async () => {
//       const customerWithInvoices = {
//         ...baseCustomer,
//         invoices: [
//           {
//             id: 'inv-1',
//             invoice_number: 'INV-001',
//             status: 'pending',
//             total_amount: mockDecimal(2000),
//             due_date: null,
//             created_at: new Date('2026-07-20'),
//             payments: [{ amount: mockDecimal(500) }],
//           },
//         ],
//       };

//       (repo.findById as any).mock.mockImplementation(async () => customerWithInvoices);

//       const result = await service.findById('cust-uuid-1', 'company-uuid');

//       assert.strictEqual(result.id, 'cust-uuid-1');
//       assert.strictEqual(result.current_debt, 1500); // 2000 - 500
//       assert.strictEqual(result.recent_transactions.length, 1);
//       assert.strictEqual(result.recent_transactions[0]!.paid_amount, 500);
//     });

//     void it('throws 404 when customer not found', async () => {
//       (repo.findById as any).mock.mockImplementation(async () => null);

//       await assert.rejects(
//         () => service.findById('nonexistent', 'company-uuid'),
//         (err: any) => err instanceof AppError && err.statusCode === 404
//       );
//     });
//   });

//   void describe('list()', () => {
//     const customers = [
//       { ...baseCustomer, id: 'c1', name: 'Alpha', opening_balance: mockDecimal(0) },
//       { ...baseCustomer, id: 'c2', name: 'Beta', opening_balance: mockDecimal(100) },
//       { ...baseCustomer, id: 'c3', name: 'Gamma', opening_balance: mockDecimal(200) },
//     ];

//     const allWithInvoices = customers.map((c) => ({ ...c, invoices: [] }));

//     void it('returns paginated list without search', async () => {
//       (repo.findByCompanyId as any).mock.mockImplementation(async () => customers);
//       (repo.countByCompanyId as any).mock.mockImplementation(async () => 3);
//       (repo.findAllWithInvoices as any).mock.mockImplementation(async () => allWithInvoices);

//       const result = await service.list({
//         companyId: 'company-uuid', page: 1, limit: 10,
//       });

//       assert.strictEqual(result.data.length, 3);
//       assert.strictEqual(result.pagination.total, 3);
//     });

//     void it('uses search when provided', async () => {
//       (repo.search as any).mock.mockImplementation(async () => [customers[0]!]);
//       (repo.searchCount as any).mock.mockImplementation(async () => 1);
//       (repo.findAllWithInvoices as any).mock.mockImplementation(async () => [allWithInvoices[0]!]);

//       const result = await service.list({
//         companyId: 'company-uuid', page: 1, limit: 10, search: 'Alpha',
//       });

//       assert.strictEqual(result.data.length, 1);
//       assert.strictEqual(result.data[0]!.name, 'Alpha');
//       assert.strictEqual((repo.search as any).mock.callCount(), 1);
//       assert.strictEqual((repo.findByCompanyId as any).mock.callCount(), 0);
//     });

//     void it('filters by debt_status = has_debt', async () => {
//       (repo.findByCompanyId as any).mock.mockImplementation(async () => customers);
//       (repo.countByCompanyId as any).mock.mockImplementation(async () => 3);
//       (repo.findAllWithInvoices as any).mock.mockImplementation(async () => allWithInvoices);

//       const result = await service.list({
//         companyId: 'company-uuid', page: 1, limit: 10, debt_status: 'has_debt',
//       });

//       assert.ok(result.data.every((c: any) => c.current_debt > 0));
//     });

//     void it('filters by debt_status = zero_debt', async () => {
//       const c1noInvoice = [{ ...baseCustomer, id: 'c1', name: 'Alpha', opening_balance: mockDecimal(0), invoices: [] }];
//       (repo.findByCompanyId as any).mock.mockImplementation(async () => [customers[0]]);
//       (repo.countByCompanyId as any).mock.mockImplementation(async () => 1);
//       (repo.findAllWithInvoices as any).mock.mockImplementation(async () => c1noInvoice);

//       const result = await service.list({
//         companyId: 'company-uuid', page: 1, limit: 10, debt_status: 'zero_debt',
//       });

//       assert.strictEqual(result.data.length, 1);
//       assert.strictEqual(result.data[0]!.current_debt, 0);
//     });
//   });

//   void describe('update()', () => {
//     void it('updates customer fields and returns with debt', async () => {
//       (repo.findById as any).mock.mockImplementation(async () => ({ ...baseCustomer, invoices: [] }));
//       (repo.update as any).mock.mockImplementation(async (_id: string, _cid: string, data: any) => ({
//         ...baseCustomer, ...data, opening_balance: mockDecimal(500),
//       }));

//       const result = await service.update('cust-uuid-1', 'company-uuid', {
//         name: 'Updated Corp', phone: null, email: null, address: null,
//       });

//       assert.strictEqual(result.name, 'Updated Corp');
//       assert.strictEqual(result.current_debt, 0);
//     });

//     void it('throws 404 when customer not found', async () => {
//       (repo.findById as any).mock.mockImplementation(async () => null);

//       await assert.rejects(
//         () => service.update('nonexistent', 'company-uuid', { name: 'X' }),
//         (err: any) => err instanceof AppError && err.statusCode === 404
//       );
//     });
//   });

//   void describe('delete()', () => {
//     void it('deletes customer with no invoices', async () => {
//       (repo.findById as any).mock.mockImplementation(async () => baseCustomer);
//       (repo.countInvoices as any).mock.mockImplementation(async () => 0);
//       (repo.delete as any).mock.mockImplementation(async () => {});

//       await service.delete('cust-uuid-1', 'company-uuid');
//       assert.strictEqual((repo.delete as any).mock.callCount(), 1);
//     });

//     void it('throws 400 when customer has invoices', async () => {
//       (repo.findById as any).mock.mockImplementation(async () => baseCustomer);
//       (repo.countInvoices as any).mock.mockImplementation(async () => 5);

//       await assert.rejects(
//         () => service.delete('cust-uuid-1', 'company-uuid'),
//         (err: any) => err instanceof AppError && err.statusCode === 400
//       );
//       assert.strictEqual((repo.delete as any).mock.callCount(), 0);
//     });

//     void it('throws 404 when customer not found', async () => {
//       (repo.findById as any).mock.mockImplementation(async () => null);

//       await assert.rejects(
//         () => service.delete('nonexistent', 'company-uuid'),
//         (err: any) => err instanceof AppError && err.statusCode === 404
//       );
//     });
//   });

//   void describe('getDebt()', () => {
//     void it('returns full debt breakdown', async () => {
//       const customer = {
//         ...baseCustomer,
//         invoices: [
//           {
//             id: 'inv-1', invoice_number: 'INV-001', status: 'pending',
//             total_amount: mockDecimal(3000),
//             payments: [{ amount: mockDecimal(1000) }, { amount: mockDecimal(500) }],
//           },
//           {
//             id: 'inv-2', invoice_number: 'INV-002', status: 'paid',
//             total_amount: mockDecimal(1000),
//             payments: [{ amount: mockDecimal(1000) }],
//           },
//         ],
//       };

//       (repo.findByIdWithInvoices as any).mock.mockImplementation(async () => customer);

//       const result = await service.getDebt('cust-uuid-1', 'company-uuid');

//       assert.strictEqual(result.customer_name, 'Acme Corp');
//       assert.strictEqual(result.total_invoice_amount, 4000);
//       assert.strictEqual(result.total_paid, 2500);
//       assert.strictEqual(result.current_debt, 1500);
//       assert.strictEqual(result.breakdown.length, 2);
//     });

//     void it('skips canceled invoices', async () => {
//       const customer = {
//         ...baseCustomer,
//         invoices: [
//           {
//             id: 'inv-1', invoice_number: 'INV-001', status: 'canceled',
//             total_amount: mockDecimal(5000),
//             payments: [],
//           },
//         ],
//       };

//       (repo.findByIdWithInvoices as any).mock.mockImplementation(async () => customer);

//       const result = await service.getDebt('cust-uuid-1', 'company-uuid');
//       assert.strictEqual(result.total_invoice_amount, 0);
//       assert.strictEqual(result.current_debt, 0);
//     });
//   });

//   void describe('getSummary()', () => {
//     void it('groups by debt status', async () => {
//       const customers = [
//         { ...baseCustomer, id: 'c1', invoices: [
//           { status: 'pending', total_amount: mockDecimal(100), payments: [] },
//         ]},
//         { ...baseCustomer, id: 'c2', invoices: [] },
//         { ...baseCustomer, id: 'c3', invoices: [
//           { status: 'partially_paid', total_amount: mockDecimal(500), payments: [{ amount: mockDecimal(600) }] },
//         ]},
//       ];

//       (repo.findAllWithInvoices as any).mock.mockImplementation(async () => customers);

//       const result = await service.getSummary('company-uuid');

//       assert.strictEqual(result.total, 3);
//       assert.strictEqual(result.with_debt, 1);   // c1 owes 100
//       assert.strictEqual(result.zero_debt, 1);    // c2 no invoices
//       assert.strictEqual(result.credit_balance, 1); // c3 overpaid by 100
//     });
//   });

//   void describe('getDebtors()', () => {
//     void it('returns only debtors sorted by debt descending', async () => {
//       const customers = [
//         { ...baseCustomer, id: 'd1', name: 'Big Debtor', invoices: [
//           { status: 'pending', total_amount: mockDecimal(5000), payments: [] },
//         ]},
//         { ...baseCustomer, id: 'd2', name: 'Small Debtor', invoices: [
//           { status: 'pending', total_amount: mockDecimal(500), payments: [] },
//         ]},
//         { ...baseCustomer, id: 'd3', name: 'No Debt', invoices: [] },
//       ];

//       (repo.findAllWithInvoices as any).mock.mockImplementation(async () => customers);

//       const result = await service.getDebtors({
//         companyId: 'company-uuid', page: 1, limit: 10,
//       });

//       assert.strictEqual(result.data.length, 2);
//       assert.strictEqual(result.data[0]!.name, 'Big Debtor');
//       assert.strictEqual(result.data[0]!.current_debt, 5000);
//       assert.strictEqual(result.data[1]!.current_debt, 500);
//     });

//     void it('filters by search', async () => {
//       const customers = [
//         { ...baseCustomer, id: 'd1', name: 'John Smith', phone: '+111', invoices: [
//           { status: 'pending', total_amount: mockDecimal(100), payments: [] },
//         ]},
//         { ...baseCustomer, id: 'd2', name: 'Jane Doe', phone: '+222', invoices: [
//           { status: 'pending', total_amount: mockDecimal(200), payments: [] },
//         ]},
//       ];

//       (repo.findAllWithInvoices as any).mock.mockImplementation(async () => customers);

//       const result = await service.getDebtors({
//         companyId: 'company-uuid', page: 1, limit: 10, search: 'john',
//       });

//       assert.strictEqual(result.data.length, 1);
//       assert.strictEqual(result.data[0]!.name, 'John Smith');
//     });

//     void it('paginates correctly', async () => {
//       const customers = Array.from({ length: 5 }, (_, i) => ({
//         ...baseCustomer, id: `d${i}`, name: `Debtor ${i}`,
//         invoices: [{ status: 'pending', total_amount: mockDecimal(100), payments: [] }],
//       }));

//       (repo.findAllWithInvoices as any).mock.mockImplementation(async () => customers);

//       const result = await service.getDebtors({
//         companyId: 'company-uuid', page: 2, limit: 2,
//       });

//       assert.strictEqual(result.data.length, 2); // items at index 2,3 of 5
//       assert.strictEqual(result.pagination.total, 5);
//       assert.strictEqual(result.pagination.pages, 3);
//     });
//   });

//   void describe('uploadImage()', () => {
//     void it('updates image_url and returns it', async () => {
//       (repo.findById as any).mock.mockImplementation(async () => baseCustomer);
//       (repo.updateImage as any).mock.mockImplementation(
//         async () => ({ ...baseCustomer, image_url: '/uploads/customers/img.jpg' })
//       );

//       const result = await service.uploadImage('cust-uuid-1', 'company-uuid', '/uploads/customers/img.jpg');
//       assert.strictEqual(result.image_url, '/uploads/customers/img.jpg');
//     });

//     void it('throws 404 if customer not found', async () => {
//       (repo.findById as any).mock.mockImplementation(async () => null);

//       await assert.rejects(
//         () => service.uploadImage('nonexistent', 'company-uuid', '/img.jpg'),
//         (err: any) => err instanceof AppError && err.statusCode === 404
//       );
//     });
//   });

//   void describe('calculateDebt() (via list)', () => {
//     void it('counts unpaid invoice amounts minus payments', async () => {
//       const customer = {
//         ...baseCustomer,
//         invoices: [
//           { status: 'pending', total_amount: mockDecimal(1000), payments: [{ amount: mockDecimal(300) }] },
//           { status: 'partially_paid', total_amount: mockDecimal(2000), payments: [{ amount: mockDecimal(2000) }] },
//         ],
//       };

//       (repo.findByCompanyId as any).mock.mockImplementation(async () => [customer]);
//       (repo.countByCompanyId as any).mock.mockImplementation(async () => 1);
//       (repo.findAllWithInvoices as any).mock.mockImplementation(async () => [customer]);

//       const result = await service.list({
//         companyId: 'company-uuid', page: 1, limit: 10,
//       });

//       // pending: 1000 - 300 = 700 ; partially_paid is still unpaid? No, 2000 - 2000 = 0
//       assert.strictEqual(result.data[0]!.current_debt, 700);
//     });
//   });
// });
