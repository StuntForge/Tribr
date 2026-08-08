-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "phoneVerifiedAt" DATETIME,
    "acceptedTermsAt" DATETIME,
    "firstName" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "locationLabel" TEXT,
    "locationLat" REAL,
    "locationLng" REAL,
    "homeAddress" TEXT,
    "bio" TEXT,
    "profilePhotoUrl" TEXT,
    "profileComplete" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionTier" TEXT NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lookingForGroup" BOOLEAN NOT NULL DEFAULT false,
    "workerSeedApplied" BOOLEAN NOT NULL DEFAULT true,
    "hostSeedApplied" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("acceptedTermsAt", "age", "bio", "createdAt", "firstName", "gender", "homeAddress", "hostSeedApplied", "id", "locationLabel", "locationLat", "locationLng", "phone", "phoneVerifiedAt", "profileComplete", "profilePhotoUrl", "status", "subscriptionTier", "updatedAt", "workerSeedApplied") SELECT "acceptedTermsAt", "age", "bio", "createdAt", "firstName", "gender", "homeAddress", "hostSeedApplied", "id", "locationLabel", "locationLat", "locationLng", "phone", "phoneVerifiedAt", "profileComplete", "profilePhotoUrl", "status", "subscriptionTier", "updatedAt", "workerSeedApplied" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
