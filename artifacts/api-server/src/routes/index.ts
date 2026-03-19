import { Router, type IRouter } from "express";
import healthRouter from "./health";
import categoriesRouter from "./categories";
import suppliersRouter from "./suppliers";
import medicinesRouter from "./medicines";
import customersRouter from "./customers";
import salesRouter from "./sales";
import purchasesRouter from "./purchases";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/categories", categoriesRouter);
router.use("/suppliers", suppliersRouter);
router.use("/medicines", medicinesRouter);
router.use("/customers", customersRouter);
router.use("/sales", salesRouter);
router.use("/purchases", purchasesRouter);
router.use("/reports", reportsRouter);
router.use("/dashboard", dashboardRouter);

export default router;
