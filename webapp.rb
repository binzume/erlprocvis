require 'sinatra/base'
require_relative('erlang')
require 'json'
require 'time'


class WebApp < Sinatra::Base
  configure :development do
    require 'sinatra/reloader'
    register Sinatra::Reloader
  end

  configure do
    set :public_folder, 'public'
    set :target_host, ENV['TARGET_HOST'] || 'localhost'

    selfnode = "rubyerltest@" + Socket.gethostname
    settings.erl.down() if settings.respond_to?(:erl)
    cookie = ENV['ERL_COOKIE'] || (File.exists?(ENV['HOME']+"/.erlang.cookie") && File.read(ENV['HOME']+"/.erlang.cookie"))
    erl = Erlang::Erl.new(selfnode, cookie, settings.target_host, false)
    set :erl, erl
  end

  get "/" do
    send_file File.join(settings.public_folder, 'index.html')
  end

  helpers do
    def assoc_to_hash(assoc)
      Hash[assoc.map{|e|
        if e.is_a?(Erlang::Tuple)
          [e.to_a[0], e.to_a[1]]
        else
          [nil, e]
        end
      }]
    end

    def proc_info(node, pid)
      erl = settings.erl
      info = erl.rpc_call(node, :erlang, :process_info, [pid, [:initial_call, :links, :monitors, :message_queue_len, :total_heap_size, :registered_name, :trap_exit]])
      if info != :undefined
        infomap = assoc_to_hash(info)
        monitors = infomap[:monitors].map{|m| m[1]}
        registered_name = infomap[:registered_name].empty? ? nil : infomap[:registered_name];
        initial_call = infomap[:initial_call][0].to_s + ":" + infomap[:initial_call][1].to_s + "/" + infomap[:initial_call][2].to_s
        if infomap[:initial_call][0] == :proc_lib
          d = erl.rpc_call(node, :proc_lib, :translate_initial_call, [pid])
          initial_call = d[0].to_s + ":" + d[1].to_s
        end
        {id: pid, alive: true, initial_call: initial_call, registered_name: registered_name,
          monitors: monitors, links: infomap[:links], total_heap_size: infomap[:total_heap_size], trap_exit: (infomap[:trap_exit] == :true),
           message_queue_len: infomap[:message_queue_len] }
      else
        {name: pid, alive: false}
      end
    end
  end

  get '/nodes' do
      erl = settings.erl

      if erl.nodes.empty?
        # connect to nodes.
        Erlang::Epmd.names(settings.target_host).each{|name, port| erl.connect("#{name}@#{settings.target_host}", port) }
      end

      nodes = erl.nodes
      if erl.nodes.size() > 0  && params['cluster'] == 'true'
        node = erl.nodes[0]
        nodes = [node] + erl.rpc_call(node, :erlang, :nodes, [])
      end
      if params['deep'] == 'true'
        nodes = nodes.map{|node|
            erl.connect(node.to_s) unless erl.nodes.include?(node.to_s)
            {name: node.to_s,
              process_count: erl.rpc_call(node, :erlang, :system_info, [:process_count]),
              memory: assoc_to_hash(erl.rpc_call(node, :erlang, :memory, [])),
            }
          }
      end
      JSON.generate({status: 'ok', nodes: nodes })
  end

  get '/nodes/:node' do
      erl = settings.erl
      if params['node'] =~/^@([\w\.\-]+)$/
        host = $1
        nodes = Erlang::Epmd.names(host).map{|name, port| "#{name}@#{host}" }
        content_type :json
        JSON.generate({status: 'ok', nodes: nodes})
      else
        content_type :json
        node = params['node']
        nodeinfo = nil
        if !erl.nodes.include?(node) && params['connect'] == 'true'
          begin
            erl.connect(node)
          rescue => e
            p e
          end
        end
        if erl.nodes.include?(node)
          nodeinfo = {
            name: node.to_s,
            process_count: erl.rpc_call(node, :erlang, :system_info, [:process_count]),
            memory: assoc_to_hash(erl.rpc_call(node, :erlang, :memory, [])),
          }
        end
        JSON.generate({status: 'ok', timestamp: Time.now(), connected: erl.nodes.include?(node), node: nodeinfo})
      end
  end

  get '/nodes/_/procs' do
      erl = settings.erl

      if erl.nodes.empty?
        # connect to nodes.
        Erlang::Epmd.names(settings.target_host).each{|name, port| erl.connect("#{name}@#{settings.target_host}", port) }
      end

      proc_infos = erl.nodes.reduce([]){|acc, node|
        procs = erl.rpc_call(node, :erlang, :processes, [])
        acc += procs.map{|pid|
          proc_info(node, pid)
        }
      }

      content_type :json
      JSON.generate({status: 'ok', processes: proc_infos})
  end

  get '/nodes/:node/procs' do # experimental
      erl = settings.erl
      node = params['node']
      unless erl.nodes.include?(node)
        erl.connect(node)
      end
      unless erl.nodes.include?(node)
        raise('cannot_connect')
      end

      proc_infos1 = erl.eval(node, <<'ENDOFCODE')
lists:map(fun(Pid)->
 case erlang:process_info(Pid, [initial_call, links, monitors, message_queue_len, total_heap_size, registered_name, trap_exit]) of
  undefined -> #{id => Pid};
  I-> IC=case lists:keysearch(initial_call,1, I) of {_,{proc_lib,_,_}}->proc_lib:translate_initial_call(Pid); _IC->_IC end,
      maps:from_list([{id, Pid}, {initial_call, IC} | I]) end end, erlang:processes()).
ENDOFCODE
      p proc_infos1  if proc_infos1.class == Erlang::Tuple # TODO error
      proc_infos = proc_infos1.map{|infomap|
        infomap[:alive] = infomap[:total_heap_size] != nil
        infomap[:monitors] = infomap[:monitors].map{|m| m[1]} if infomap[:monitors]
        infomap[:registered_name] = nil if infomap[:registered_name] == []
        infomap[:trap_exit] = infomap[:trap_exit] == :true
        ic = infomap[:initial_call]
        if ic
          infomap[:initial_call] = "#{ic[0]}:#{ic[1]}/#{ic[2]}"
        end
        infomap
      }

      content_type :json
      JSON.generate({status: 'ok', processes: proc_infos})
  end

  get '/nodes/:node/procs_' do
      erl = settings.erl
      node = params['node']
      unless erl.nodes.include?(node)
        erl.connect(node)
      end
      unless erl.nodes.include?(node)
        raise('cannot_connect')
      end

      procs = erl.rpc_call(node, :erlang, :processes, [])
      proc_infos = procs.map{|pid|
        proc_info(node, pid)
      }

      content_type :json
      JSON.generate({status: 'ok', processes: proc_infos})
  end

  get '/nodes/:node/procs/:pid' do
      erl = settings.erl
      node = params['node']
      pida = params['pid'].split('.')
      pid = Erlang::Pid.new(node, pida[1].to_i, pida[2].to_i, pida[0].to_i)

      content_type :json
      JSON.generate({status: 'ok', process: proc_info(node, pid)})
  end

  delete '/nodes/:node/procs/:pid' do
      erl = settings.erl
      node = params['node']
      pida = params['pid'].split('.')
      pid = Erlang::Pid.new(node, pida[1].to_i, pida[2].to_i, pida[0].to_i)

      rr = erl.rpc_call(node, :erlang, :exit, [pid, :kill])

      content_type :json
      JSON.generate({status: 'ok', result: rr})
  end

  post '/nodes/:node/exec' do
      erl = settings.erl
      node = params['node']
      code = params['code']
      unless erl.nodes.include?(node)
        erl.connect(node)
      end
      unless erl.nodes.include?(node)
        raise('cannot_connect')
      end

      rr = erl.eval(node, code)
      rr = rr.to_s if params['result_as_string'] == 'true'

      content_type :json
      JSON.generate({status: 'ok', node: node, result: rr})
  end

  post '/nodes/:node/code' do
      erl = settings.erl
      node = params['node']
      if params['beam'][:filename] =~ /(\w+)\.beam$/
        modname = $1.to_sym
      else
        raise("not beam")
      end
      beam = params['beam'][:tempfile].read

      unless erl.nodes.include?(node)
        erl.connect(node)
      end
      unless erl.nodes.include?(node)
        raise('cannot_connect')
      end

      if erl.rpc_call(node, :code, :soft_purge, [modname]) != :true
        if params['FORCE_PURGE'] == 'true'
          erl.rpc_call(node, :code, :purge, [modname])
        else
          raise('code purge error')
        end
      end
      rr = erl.rpc_call(node, :code, :load_binary, [modname, "/dummy/#{modname}.beam", Erlang::Binary.new(beam)])

      content_type :json
      JSON.generate({status: 'ok', node: node, result: rr})
  end
end
