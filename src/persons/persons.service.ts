import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  ConflictException,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class PersonsService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async createPerson(dto: CreatePersonDto) {
    const locality = await this.locality.findUnique({
      where: { locality_id: dto.localityId },
    });
    if (!locality)
      throw new BadRequestException(`Localidad ${dto.localityId} no encontrada`);

    const zone = await this.zone.findUnique({
      where: { zone_id: dto.zoneId },
    });
    if (!zone) throw new BadRequestException(`Zona ${dto.zoneId} no encontrada`);

    let registration_date: Date | undefined = undefined;
    if (dto.registrationDate) {
      const date = new Date(dto.registrationDate);
      if (!isNaN(date.getTime())) {
        registration_date = date;
      } else {
        throw new BadRequestException('registrationDate inválido');
      }
    }
    const data: Prisma.personCreateInput = {
      name: dto.name,
      phone: dto.phone,
      address: dto.address,
      ...(registration_date && { registration_date }),
      locality: { connect: { locality_id: dto.localityId } },
      zone: { connect: { zone_id: dto.zoneId } },
      type: dto.type,
    };

    try {
      return await this.person.create({ data });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('El teléfono ya está registrado para otra persona.');
      }
      throw error;
    }
  }

  async findAllPersons() {
    return this.person.findMany();
  }

  async findPersonById(id: number) {
    const person = await this.person.findUnique({
      where: {
        person_id: id
      },
    });
    if (!person) throw new NotFoundException(`Persona ${id} no encontrada`);
    return person;
  }

  async findPersonByName(name: string) {
    const persons = await this.person.findMany(
      {
        where: {
          name: {
            contains: name,
            mode: 'insensitive'
          }
        }
      });

    if (!persons || persons.length === 0) {
      throw new NotFoundException('No se encontró ninguna persona con ese nombre');
    }
    return persons;
  }

  async findPersonByAddress(address: string) {
    const persons = await this.person.findMany(
      {
        where: {
          address: {
            contains: address,
            mode: 'insensitive'
          }
        }
      });
    if (!persons || persons.length === 0) {
      throw new NotFoundException('No se encontró ninguna persona con esa dirección');
    }
    return persons;
  }

  async updatePerson(id: number, dto: UpdatePersonDto) {
    await this.findPersonById(id);

    if (dto.localityId) {
      const loc = await this.locality.findUnique({ where: { locality_id: dto.localityId } });
      if (!loc) throw new BadRequestException(`Localidad ${dto.localityId} no encontrada`);
    }
    if (dto.zoneId) {
      const zn = await this.zone.findUnique({ where: { zone_id: dto.zoneId } });
      if (!zn) throw new BadRequestException(`Zona ${dto.zoneId} no encontrada`);
    }

    const data: Prisma.personUncheckedUpdateInput = {
      ...dto,
      registration_date: dto.registrationDate ? new Date(dto.registrationDate) : undefined,
      locality_id: dto.localityId,
      zone_id: dto.zoneId,
    };

    return this.person.update({ where: { person_id: id }, data });
  }

  async deletePerson(id: number) {
    await this.findPersonById(id);
    return this.person.delete({ where: { person_id: id } });
  }
}
