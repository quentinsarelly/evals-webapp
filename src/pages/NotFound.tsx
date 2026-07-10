import React from "react";
import { Link } from "react-router-dom";

const NotFound: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center space-y-2">
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <Link to="/" className="text-primary underline">
        Volver al inicio
      </Link>
    </div>
  </div>
);

export default NotFound;
