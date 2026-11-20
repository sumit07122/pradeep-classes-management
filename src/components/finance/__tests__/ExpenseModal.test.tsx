import React from "react";
import { ExpenseModal } from "../ExpenseModal";
import { ExpenseReversalModal } from "../ExpenseReversalModal";

export function testExpenseModals() {
  const modalEl = React.createElement(ExpenseModal, {
    isOpen: true,
    onClose: () => {},
    onSuccess: () => {},
  });
  if (!modalEl) throw new Error("Failed to create ExpenseModal element");

  const reversalEl = React.createElement(ExpenseReversalModal, {
    isOpen: true,
    expense: null,
    onClose: () => {},
    onSuccess: () => {},
  });
  if (!reversalEl) throw new Error("Failed to create ExpenseReversalModal element");

  console.log("Expense modals test passed");
}
