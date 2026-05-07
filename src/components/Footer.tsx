export function Footer() {
  return (
    <footer className="bg-white border-t border-brand-primary/5 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3 text-white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <span className="font-bold text-lg tracking-tight text-brand-primary">MillionsNest</span>
            </div>
            <p className="text-sm font-medium text-brand-primary/50 max-w-sm">
              Construindo tecnologia e ferramentas modernas para fortalecer igrejas e líderes. A próxima geração da gestão ministerial.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold text-sm text-brand-primary mb-4 uppercase tracking-wider">Soluções</h4>
            <ul className="space-y-3">
              <li><a href="#musicscale" className="text-sm font-medium text-brand-primary/60 hover:text-brand-primary transition-colors">MusicScale</a></li>
              <li><a href="#" className="text-sm font-medium text-brand-primary/60 hover:text-brand-primary transition-colors">CultoFlow <span className="text-[10px] bg-brand-primary/5 px-1.5 py-0.5 rounded ml-1 text-brand-primary/40">Em breve</span></a></li>
              <li><a href="#" className="text-sm font-medium text-brand-primary/60 hover:text-brand-primary transition-colors">CellHub <span className="text-[10px] bg-brand-primary/5 px-1.5 py-0.5 rounded ml-1 text-brand-primary/40">Em breve</span></a></li>
              <li><a href="#" className="text-sm font-medium text-brand-primary/60 hover:text-brand-primary transition-colors">VisitTrack <span className="text-[10px] bg-brand-primary/5 px-1.5 py-0.5 rounded ml-1 text-brand-primary/40">Em breve</span></a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm text-brand-primary mb-4 uppercase tracking-wider">Legal</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-sm font-medium text-brand-primary/60 hover:text-brand-primary transition-colors">Termos de Uso</a></li>
              <li><a href="#" className="text-sm font-medium text-brand-primary/60 hover:text-brand-primary transition-colors">Política de Privacidade</a></li>
              <li><a href="#" className="text-sm font-medium text-brand-primary/60 hover:text-brand-primary transition-colors">Políticas de Reembolso</a></li>
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
