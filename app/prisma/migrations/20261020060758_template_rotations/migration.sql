-- CreateTable
CREATE TABLE "CalendarWeek" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateRotation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startWeekId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateRotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateRotationEntry" (
    "id" TEXT NOT NULL,
    "rotationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "TemplateRotationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarWeek_templateId_idx" ON "CalendarWeek"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarWeek_userId_weekId_key" ON "CalendarWeek"("userId", "weekId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateRotation_userId_name_key" ON "TemplateRotation"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateRotation_userId_startWeekId_key" ON "TemplateRotation"("userId", "startWeekId");

-- CreateIndex
CREATE INDEX "TemplateRotationEntry_templateId_idx" ON "TemplateRotationEntry"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateRotationEntry_rotationId_position_key" ON "TemplateRotationEntry"("rotationId", "position");

-- AddForeignKey
ALTER TABLE "CalendarWeek" ADD CONSTRAINT "CalendarWeek_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarWeek" ADD CONSTRAINT "CalendarWeek_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateRotation" ADD CONSTRAINT "TemplateRotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateRotationEntry" ADD CONSTRAINT "TemplateRotationEntry_rotationId_fkey" FOREIGN KEY ("rotationId") REFERENCES "TemplateRotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateRotationEntry" ADD CONSTRAINT "TemplateRotationEntry_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

