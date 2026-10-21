import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import ComparisonPage from "./pages/ComparisonPage";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import ReaderPage from "./pages/ReaderPage";
import SourcesPage from "./pages/SourcesPage";

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/reader/:documentId" component={ReaderPage} />
    <Route path="/comparison" component={ComparisonPage} />
    <Route path="/sources" component={SourcesPage} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
