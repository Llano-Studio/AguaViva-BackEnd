import { IsNotEmpty, IsString } from "class-validator";

export class CreateZoneDto {

    @IsString()
    @IsNotEmpty()
    code: string;

    @IsString()
    @IsNotEmpty()
    name: string;

}
