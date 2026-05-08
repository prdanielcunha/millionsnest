import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-white border-t border-brand-primary/5 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img src="/logo.png" alt="MillionsNest Logo" className="h-6 md:h-8 w-auto" />
              <span className="font-bold text-lg tracking-tight text-brand-primary">MillionsNest</span>
            </Link>
            <p className="text-sm font-medium text-brand-primary/50 max-w-sm">
              Construindo tecnologia e ferramentas modernas para fortalecer igrejas e líderes. A próxima geração da gestão ministerial.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold text-sm text-brand-primary mb-4 uppercase tracking-wider">Soluções</h4>
            <ul className="space-y-3">
              <li><a href="/#musicscale" className="text-sm font-medium text-brand-primary/60 hover:text-brand-primary transition-colors">MusicScale</a></li>
              <li><span className="text-sm font-medium text-brand-primary/60">CultoFlow <span className="text-[10px] bg-brand-primary/5 px-1.5 py-0.5 rounded ml-1 text-brand-primary/40">Em breve</span></span></li>
              <li><span className="text-sm font-medium text-brand-primary/60">CellHub <span className="text-[10px] bg-brand-primary/5 px-1.5 py-0.5 rounded ml-1 text-brand-primary/40">Em breve</span></span></li>
              <li><span className="text-sm font-medium text-brand-primary/60">VisitTrack <span className="text-[10px] bg-brand-primary/5 px-1.5 py-0.5 rounded ml-1 text-brand-primary/40">Em breve</span></span></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm text-brand-primary mb-4 uppercase tracking-wider">Legal</h4>
            <ul className="space-y-3">
              <li><Link to="/termos-de-uso" className="text-sm font-medium text-brand-primary/60 hover:text-brand-primary transition-colors">Termos de Uso</Link></li>
              <li><Link to="/politica-de-privacidade" className="text-sm font-medium text-brand-primary/60 hover:text-brand-primary transition-colors">Política de Privacidade</Link></li>
              <li><Link to="/politicas-de-cancelamento" className="text-sm font-medium text-brand-primary/60 hover:text-brand-primary transition-colors">Políticas de Cancelamento</Link></li>
              <li><Link to="/politicas-de-reembolso" className="text-sm font-medium text-brand-primary/60 hover:text-brand-primary transition-colors">Políticas de Reembolso</Link></li>
              <li><a href="#" className="text-sm font-medium text-brand-primary/60 hover:text-brand-primary transition-colors">Contato</a></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-brand-primary/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs font-medium text-brand-primary/40">
            © {new Date().getFullYear()} MillionsNest. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-1 text-xs font-medium text-brand-primary/40">
            <span>Feito com excelência no Brasil.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
