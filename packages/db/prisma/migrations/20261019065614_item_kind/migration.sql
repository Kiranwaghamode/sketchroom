-- CreateEnum
CREATE TYPE "ItemKind" AS ENUM ('BOARD', 'DOC');

-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "kind" "ItemKind" NOT NULL DEFAULT 'BOARD';
