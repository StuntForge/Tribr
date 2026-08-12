-- AlterTable
-- Optional goodbye message left when a member completes the wrap-up flow
-- for a finished Tribe, stored structurally so a final farewell report can
-- be compiled once everyone has left.
ALTER TABLE "GroupMember" ADD COLUMN "farewellMessage" TEXT;
