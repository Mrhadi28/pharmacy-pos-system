import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import billingRouter from "./billing";
import { requireActiveSubscription } from "../middleware/require-subscription";
import pharmaciesRouter from "./pharmacies";
import usersRouter from "./users";
import categoriesRouter from "./categories";
import suppliersRouter from "./suppliers";
import medicinesRouter from "./medicines";
import customersRouter from "./customers";
import salesRouter from "./sales";
import creditRouter from "./credit";
import purchasesRouter from "./purchases";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";
import accountRouter from "./account";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/billing", billingRouter);
router.use("/account", accountRouter);
router.use(requireActiveSubscription);
router.use("/pharmacies", pharmaciesRouter);
router.use("/users", usersRouter);
router.use("/categories", categoriesRouter);
router.use("/suppliers", suppliersRouter);
router.use("/medicines", medicinesRouter);
router.use("/customers", customersRouter);
router.use("/sales", salesRouter);
router.use("/credit", creditRouter);
router.use("/purchases", purchasesRouter);
router.use("/reports", reportsRouter);
router.use("/dashboard", dashboardRouter);

export default router;
