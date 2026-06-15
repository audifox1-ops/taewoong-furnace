import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let prismaMock: any;
  let jwtServiceMock: any;

  beforeEach(async () => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    jwtServiceMock = {
      sign: jest.fn().mockReturnValue('mock-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({
        id: 1,
        username: 'testuser',
        role: 'user',
      });

      const result = await service.register('testuser', 'password123');

      expect(result.user.username).toBe('testuser');
      expect(result.token).toBe('mock-token');
      expect(prismaMock.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictException for existing username', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 1, username: 'existing' });

      await expect(service.register('existing', 'password123'))
        .rejects.toThrow('Username already exists');
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      prismaMock.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'testuser',
        passwordHash: hashedPassword,
        role: 'user',
      });

      const result = await service.login('testuser', 'password123');

      expect(result.user.username).toBe('testuser');
      expect(result.token).toBe('mock-token');
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.login('nonexistent', 'password123'))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      prismaMock.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'testuser',
        passwordHash: hashedPassword,
        role: 'user',
      });

      await expect(service.login('testuser', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials');
    });
  });

  describe('deleteUser', () => {
    it('should delete a user', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 2, username: 'other' });
      prismaMock.user.delete.mockResolvedValue({ id: 2 });

      const result = await service.deleteUser(2, 1);

      expect(result.deleted).toBe(true);
    });

    it('should throw when trying to delete self', async () => {
      await expect(service.deleteUser(1, 1))
        .rejects.toThrow('Cannot delete yourself');
    });

    it('should throw when user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteUser(999, 1))
        .rejects.toThrow('User not found');
    });
  });
});
