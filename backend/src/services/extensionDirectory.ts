import prisma from "../lib/prisma";
import { WebPhoneStatus } from "@prisma/client";

interface ExtensionUser {
  id: string;
  name: string;
  email: string;
  extension: string;
  extensionLabel: string | null;
  extensionForwardingNumber?: string | null;
  webPhoneStatus: WebPhoneStatus;
  webPhoneLastSeen: Date | null;
}

export class ExtensionDirectory {
  /**
   * Find user by extension number within a tenant
   */
  static async findByExtension(
    tenantId: string,
    extension: string
  ): Promise<ExtensionUser | null> {
    const user = await prisma.user.findFirst({
      where: {
        tenantId,
        extension,
        extensionEnabled: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        extension: true,
        extensionLabel: true,
        extensionForwardingNumber: true,
        webPhoneStatus: true,
        webPhoneLastSeen: true,
      },
    });

    return user as ExtensionUser | null;
  }

  /**
   * List all extensions in a tenant with presence status
   */
  static async listExtensions(tenantId: string): Promise<ExtensionUser[]> {
    const users = await prisma.user.findMany({
      where: {
        tenantId,
        extension: { not: null },
        extensionEnabled: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        extension: true,
        extensionLabel: true,
        extensionForwardingNumber: true,
        webPhoneStatus: true,
        webPhoneLastSeen: true,
      },
      orderBy: { extension: "asc" },
    });

    return users as ExtensionUser[];
  }

  /**
   * Assign extension to a user
   */
  static async assignExtension(
    userId: string,
    tenantId: string,
    extension: string,
    label?: string,
    forwardingNumber?: string
  ): Promise<void> {
    // Validate extension format (3-4 digits)
    if (!/^\d{3,4}$/.test(extension)) {
      throw new Error("Extension must be 3-4 digits");
    }

    // Check if extension already exists for this tenant
    const existing = await prisma.user.findFirst({
      where: {
        tenantId,
        extension,
        id: { not: userId },
      },
    });

    if (existing) {
      throw new Error(`Extension ${extension} is already assigned`);
    }

    // Assign extension
    await prisma.user.update({
      where: { id: userId },
      data: {
        extension,
        extensionLabel: label || null,
        extensionForwardingNumber: forwardingNumber || null,
        extensionEnabled: true,
      },
    });
  }

  /**
   * Remove extension from user
   */
  static async removeExtension(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        extension: null,
        extensionLabel: null,
        extensionEnabled: false,
      },
    });
  }

  /**
   * Update web phone presence status
   */
  static async updatePresence(
    userId: string,
    status: WebPhoneStatus
  ): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        webPhoneStatus: status,
        webPhoneLastSeen: status === "OFFLINE" ? new Date() : undefined,
      },
    });
  }

  /**
   * Check if user is available for VoIP calls
   */
  static async isWebPhoneReady(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { webPhoneStatus: true },
    });

    return user?.webPhoneStatus === "ONLINE";
  }

  /**
   * Get next available extension number
   */
  static async getNextAvailableExtension(
    tenantId: string,
    startFrom: number = 101
  ): Promise<string> {
    const existingExtensions = await prisma.user.findMany({
      where: {
        tenantId,
        extension: { not: null },
      },
      select: { extension: true },
    });

    const usedNumbers = new Set(
      existingExtensions
        .map((u: any) => parseInt(u.extension!))
        .filter((n: number) => !isNaN(n))
    );

    for (let i = startFrom; i < 10000; i++) {
      if (!usedNumbers.has(i)) {
        return i.toString();
      }
    }

    throw new Error("No available extension numbers");
  }
}
