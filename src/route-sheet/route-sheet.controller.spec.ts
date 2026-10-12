import { ForbiddenException } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { RouteSheetController } from './route-sheet.controller';
import { RouteSheetService } from './route-sheet.service';

describe('RouteSheetController (acceso de choferes)', () => {
  const routeSheetServiceMock = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    assertDriverCanAccess: jest.fn(),
  };
  const controller = new RouteSheetController(
    routeSheetServiceMock as any,
    {} as any,
    {} as any,
    {} as any,
  );
  const driver = { id: 9, role: Role.DRIVERS } as User;
  const admin = { id: 1, role: Role.ADMINISTRATIVE } as User;

  beforeEach(() => jest.clearAllMocks());

  it('limita el listado al chofer autenticado', async () => {
    await controller.findAll({ driver_id: 3 } as any, driver);
    expect(routeSheetServiceMock.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ driver_id: 9 }),
    );
  });

  it('respeta el filtro de chofer para roles administrativos', async () => {
    await controller.findAll({ driver_id: 3 } as any, admin);
    expect(routeSheetServiceMock.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ driver_id: 3 }),
    );
  });

  it('verifica el acceso antes de devolver el detalle', async () => {
    routeSheetServiceMock.assertDriverCanAccess.mockRejectedValue(
      new ForbiddenException(),
    );
    await expect(controller.findOne(5, driver)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(routeSheetServiceMock.findOne).not.toHaveBeenCalled();
  });
});

describe('RouteSheetService.assertDriverCanAccess', () => {
  const prisma = { route_sheet: { findUnique: jest.fn() } };
  const service = Object.assign(
    Object.create(RouteSheetService.prototype) as RouteSheetService,
    { prisma },
  );

  it('rechaza a un chofer que pide una hoja ajena', async () => {
    prisma.route_sheet.findUnique.mockResolvedValue({ driver_id: 2 });
    await expect(
      service.assertDriverCanAccess(5, { id: 9, role: Role.DRIVERS } as User),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permite al chofer asignado', async () => {
    prisma.route_sheet.findUnique.mockResolvedValue({ driver_id: 9 });
    await expect(
      service.assertDriverCanAccess(5, { id: 9, role: Role.DRIVERS } as User),
    ).resolves.toBeUndefined();
  });

  it('no consulta nada para roles administrativos', async () => {
    prisma.route_sheet.findUnique.mockClear();
    await service.assertDriverCanAccess(5, {
      id: 1,
      role: Role.SUPERADMIN,
    } as User);
    expect(prisma.route_sheet.findUnique).not.toHaveBeenCalled();
  });
});
